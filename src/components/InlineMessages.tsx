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
  success: "text-success",
  error: "text-destructive",
  info: "text-info",
};

const variantSurface: Record<InlineVariant, string> = {
  default: "border-border",
  success: "border-success/30",
  error: "border-destructive/30",
  info: "border-info/30",
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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:items-end sm:px-5"
      aria-live="polite"
      aria-atomic="true"
    >
      {msgs.map((m) => {
        const Icon = variantIcon[m.variant];
        return (
          <div
            key={m.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-popover px-4 py-3 text-left text-popover-foreground shadow-lg animate-fade-in",
              variantSurface[m.variant]
            )}
            role={m.variant === "error" ? "alert" : "status"}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", variantColor[m.variant])} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              {m.title && (
                <div className="break-words text-sm font-semibold leading-snug">
                  {m.title}
                </div>
              )}
              {m.description && (
                <div className="mt-0.5 break-words text-sm leading-snug text-muted-foreground">
                  {m.description}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-2 h-9 w-9 shrink-0 text-muted-foreground"
              onClick={() => dismissMessage(m.id)}
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};

export default InlineMessages;

