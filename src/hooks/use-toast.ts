// Legacy shadcn useToast API forwarded to the InlineMessages system.
// Kept for backward compatibility with existing call sites.
import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";
import { pushMessage, dismissMessage, type InlineVariant } from "@/components/InlineMessages";

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type Toast = Omit<ToasterToast, "id">;

function nodeToString(node: React.ReactNode): string | undefined {
  if (node == null || node === false) return undefined;
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToString).filter(Boolean).join(" ");
  return undefined;
}

function toast(props: Toast) {
  const variant: InlineVariant =
    (props as any).variant === "destructive" ? "error" : "default";
  const id = pushMessage(
    {
      title: nodeToString(props.title),
      description: nodeToString(props.description),
      variant,
    },
    { duration: (props as any).duration }
  );
  return {
    id,
    dismiss: () => dismissMessage(id),
    update: (next: Partial<ToasterToast>) => {
      pushMessage(
        {
          id,
          title: nodeToString(next.title),
          description: nodeToString(next.description),
          variant:
            (next as any).variant === "destructive" ? "error" : variant,
        },
        {}
      );
    },
  };
}

function useToast() {
  return {
    toasts: [] as ToasterToast[],
    toast,
    dismiss: (id?: string) => dismissMessage(id),
  };
}

export { useToast, toast };
