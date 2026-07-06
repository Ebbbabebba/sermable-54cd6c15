import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
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

const variantStyles: Record<InlineVariant, string> = {
  default: "bg-card border-border text-foreground",
  success: "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  error: "bg-destructive/10 border-destructive/40 text-destructive",
  info: "bg-primary/10 border-primary/40 text-primary",
};

const Icon = ({ variant }: { variant: InlineVariant }) => {
  const cls = "h-4 w-4 shrink-0 mt-0.5";
  if (variant === "success") return <CheckCircle2 className={cls} />;
  if (variant === "error") return <AlertCircle className={cls} />;
  if (variant === "info") return <Info className={cls} />;
  return <Info className={cls} />;
};

const InlineMessages = () => {
  const [msgs, setMsgs] = useState<InlineMessage[]>(messages);
  useEffect(() => subscribe(setMsgs), []);
  if (msgs.length === 0) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[min(92vw,420px)] px-2 pointer-events-none"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      role="status"
      aria-live="polite"
    >
      {msgs.map((m) => (
        <div
          key={m.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur-sm animate-fade-in text-sm",
            variantStyles[m.variant]
          )}
        >
          <Icon variant={m.variant} />
          <div className="flex-1 min-w-0">
            {m.title && <div className="font-medium leading-snug">{m.title}</div>}
            {m.description && (
              <div className="text-xs opacity-80 leading-snug mt-0.5 break-words">
                {m.description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissMessage(m.id)}
            className="opacity-60 hover:opacity-100 transition-opacity -mr-1"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default InlineMessages;
