// Shared push notification sender.
// - iOS tokens: sent via APNS HTTP/2 with an ES256 JWT (provider token auth).
// - Android tokens: sent via legacy FCM if FCM_SERVER_KEY is set (kept for backwards-compat).
//
// Required secrets for iOS:
//   APNS_AUTH_KEY      .p8 contents, PEM ("-----BEGIN PRIVATE KEY-----...")
//   APNS_KEY_ID        10-char Key ID from Apple Developer
//   APNS_TEAM_ID       10-char Team ID
//   APNS_BUNDLE_ID     e.g. app.lovable.9b84872939c64dff8ad785a9c71f1e67
//   APNS_PRODUCTION    "true" for production APNS, "false" or unset for sandbox

interface SendArgs {
  token: string;
  platform?: "ios" | "android" | null;
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface SendResult {
  ok: boolean;
  status?: number;
  error?: string;
}

// ---- JWT (ES256) caching ----------------------------------------------------

let cachedJwt: { token: string; exp: number } | null = null;
let cachedKey: CryptoKey | null = null;

function b64urlEncode(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = input;
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const pem = Deno.env.get("APNS_AUTH_KEY");
  if (!pem) throw new Error("APNS_AUTH_KEY not set");
  const keyData = pemToArrayBuffer(pem);
  cachedKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

async function getApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // Apple rejects tokens older than 1h; refresh every 50 min.
  if (cachedJwt && cachedJwt.exp - now > 600) return cachedJwt.token;

  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  if (!keyId || !teamId) throw new Error("APNS_KEY_ID / APNS_TEAM_ID not set");

  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = { iss: teamId, iat: now };
  const signingInput =
    b64urlEncode(JSON.stringify(header)) + "." + b64urlEncode(JSON.stringify(payload));

  const key = await getSigningKey();
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = signingInput + "." + b64urlEncode(sigBuf);
  cachedJwt = { token: jwt, exp: now + 60 * 60 };
  return jwt;
}

// ---- APNS send --------------------------------------------------------------

async function sendApns(args: SendArgs): Promise<SendResult> {
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  if (!bundleId) return { ok: false, error: "APNS_BUNDLE_ID not set" };

  const production = (Deno.env.get("APNS_PRODUCTION") || "").toLowerCase() === "true";
  const host = production ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const url = `https://${host}/3/device/${args.token}`;

  let jwt: string;
  try {
    jwt = await getApnsJwt();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "jwt error" };
  }

  const payload = {
    aps: {
      alert: { title: args.title, body: args.body },
      sound: "default",
      badge: 1,
    },
    ...(args.data ?? {}),
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { ok: false, status: r.status, error: text || r.statusText };
    }
    await r.text().catch(() => "");
    return { ok: true, status: r.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch error" };
  }
}

// ---- FCM (legacy) for android -----------------------------------------------

async function sendFcmLegacy(args: SendArgs): Promise<SendResult> {
  const key = Deno.env.get("FCM_SERVER_KEY");
  if (!key) return { ok: false, error: "FCM_SERVER_KEY not set" };
  try {
    const r = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `key=${key}` },
      body: JSON.stringify({
        to: args.token,
        notification: { title: args.title, body: args.body, sound: "default", badge: 1 },
        data: args.data,
        priority: "high",
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { ok: false, status: r.status, error: text || r.statusText };
    }
    await r.text().catch(() => "");
    return { ok: true, status: r.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch error" };
  }
}

// ---- Public sender ----------------------------------------------------------

export async function sendPush(args: SendArgs): Promise<SendResult> {
  // Heuristic: APNS device tokens are 64 hex chars. FCM tokens are long
  // colon-separated strings. Use platform field when set, else infer.
  const platform =
    args.platform ??
    (/^[0-9a-fA-F]{64}$/.test(args.token) ? "ios" : "android");

  if (platform === "ios") return sendApns(args);
  return sendFcmLegacy(args);
}
