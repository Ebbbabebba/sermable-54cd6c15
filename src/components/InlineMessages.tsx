import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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

const variantColor: Record<InlineVariant, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-destructive",
  info: "text-primary",
};

const InlineMessages = () => {
  const [msgs, setMsgs] = useState<InlineMessage[]>(messages);
  useEffect(() => subscribe(setMsgs), []);
  if (msgs.length === 0) return null;
  const m = msgs[msgs.length - 1];
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-2 px-6 text-center bg-background"
      role="status"
      aria-live="polite"
      onClick={() => dismissMessage(m.id)}
    >
      <Loader2 className={cn("h-5 w-5 animate-spin opacity-70", variantColor[m.variant])} />
      {m.title && (
        <div className={cn("text-base font-medium leading-snug animate-fade-in", variantColor[m.variant])}>
          {m.title}
        </div>
      )}
      {m.description && (
        <div className="text-sm text-muted-foreground leading-snug max-w-sm animate-fade-in">
          {m.description}
        </div>
      )}
    </div>
  );
};

export default InlineMessages;

