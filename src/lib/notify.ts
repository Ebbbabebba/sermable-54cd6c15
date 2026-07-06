// Sonner-compatible shim that redirects toasts to the in-layout InlineMessages system.
// Kept API-compatible so existing `import { toast } from "sonner"` call sites work
// after a project-wide import rewrite to `@/lib/notify`.
import { pushMessage, dismissMessage, type InlineVariant } from "@/components/InlineMessages";

type Opts = { description?: string; duration?: number; id?: string };

function base(variant: InlineVariant) {
  return (message: any, opts?: Opts) => {
    const title = typeof message === "string" ? message : String(message ?? "");
    return pushMessage(
      { id: opts?.id, title, description: opts?.description, variant },
      { duration: opts?.duration }
    );
  };
}

const toastFn: any = (message: any, opts?: Opts) => base("default")(message, opts);
toastFn.success = base("success");
toastFn.error = base("error");
toastFn.info = base("info");
toastFn.warning = base("error");
toastFn.message = base("default");
toastFn.loading = base("info");
toastFn.dismiss = (id?: string) => dismissMessage(id);
toastFn.custom = (renderOrTitle: any) => base("default")(String(renderOrTitle ?? ""));
toastFn.promise = async <T,>(
  p: Promise<T>,
  msgs: { loading?: string; success?: string | ((v: T) => string); error?: string | ((e: any) => string) }
) => {
  const id = base("info")(msgs.loading ?? "Loading...");
  try {
    const v = await p;
    dismissMessage(id);
    const s = typeof msgs.success === "function" ? msgs.success(v) : msgs.success;
    if (s) base("success")(s);
    return v;
  } catch (e) {
    dismissMessage(id);
    const err = typeof msgs.error === "function" ? msgs.error(e) : msgs.error;
    if (err) base("error")(err);
    throw e;
  }
};

export const toast = toastFn;
export default toast;
