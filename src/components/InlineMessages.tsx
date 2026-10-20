import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


export type InlineVariant = "default" | "success" | "error" | "info";

export interface InlineMessage {
  id: string;
  title?: string;
  description?: string;
  variant: InlineVariant;
}

type Listener = (msgs: InlineMessage[]) => void;

let messages: InlineMessage[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((l) => l(messages));
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function pushMessage(
  input: string | Partial<InlineMessage> | undefined,
  opts?: { description?: string; variant?: InlineVariant; duration?: number }
): string {
  let msg: InlineMessage;
  if (typeof input === "string") {
    msg = {
      id: genId(),
      title: input,
      description: opts?.description,
      variant: opts?.variant ?? "default",
    };
  } else {
    msg = {
      id: input?.id ?? genId(),
      title: input?.title,
      description: input?.description ?? opts?.description,
      variant: (input?.variant as InlineVariant) ?? opts?.variant ?? "default",
    };
  }
  // Confirmation pop-ups ("Tal skapat", "Klart!") are deliberately not shown;
  // only genuine problems (variant "error") interrupt the user.
  if (msg.variant !== "error") return msg.id;
  messages = [...messages.filter((m) => m.id !== msg.id), msg].slice(-4);
  emit();
  const duration = opts?.duration ?? (msg.variant === "error" ? 6000 : 4000);
  if (duration > 0) {
    const t = setTimeout(() => dismissMessage(msg.id), duration);
    timers.set(msg.id, t);
  }
  return msg.id;
}

export function dismissMessage(id?: string) {
  if (id) {
    const t = timers.get(id);
    if (t) clearTimeout(t);
    timers.delete(id);
    messages = messages.filter((m) => m.id !== id);
  } else {
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    messages = [];
  }
  emit();
}

export function subscribe(l: Listener) {
  listeners.add(l);
  l(messages);
  return () => {
    listeners.delete(l);
  };
}

const variantColor: Record<InlineVariant, string> = {
  default: "s-u9",
  success: "s-va",
  error: "s-u2",
  info: "s-uh",
};

const variantSurface: Record<InlineVariant, string> = {
  default: "s-6x",
  success: "s-80",
  error: "s-77",
  info: "s-7f",
};

const variantIcon = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const InlineMessages = () => {
  const { t } = useTranslation();
  const [msgs, setMsgs] = useState<InlineMessage[]>(messages);
  useEffect(() => subscribe(setMsgs), []);
  if (msgs.length === 0) return null;
  return (
    <div
      className="s-nx s-c4 s-i6 s-8b s-yk s-c5 s-c7 s-ib s-dn s-or s-nc s-rs s-s9"
      aria-live="polite"
      aria-atomic="true"
    >
      {msgs.map((m) => {
        const Icon = variantIcon[m.variant];
        return (
          <div
            key={m.id}
            className={cn(
              "s-nw s-c5 s-y7 s-js s-id s-dp s-q9 s-6l s-5b s-os s-p6 s-uj s-uv s-qx s-2y",
              variantSurface[m.variant]
            )}
            role={m.variant === "error" ? "alert" : "status"}
          >
            <Icon className={cn("s-ls s-g1 s-xv s-r5", variantColor[m.variant])} aria-hidden="true" />
            <div className="s-l8 s-c6">
              {m.title && (
                <div className="s-8h s-v9 s-d3 s-iq">
                  {m.title}
                </div>
              )}
              {m.description && (
                <div className="s-ls s-8h s-v9 s-iq s-ul">
                  {m.description}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-2 s-g8 s-y2 s-r5 s-ul"
              onClick={() => dismissMessage(m.id)}
              aria-label={t("common.close")}
            >
              <X className="s-fz s-xt" aria-hidden="true" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};

export default InlineMessages;

