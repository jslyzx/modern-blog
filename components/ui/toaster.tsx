"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

import { ToastVariant, useToast } from "./use-toast";

const variantClasses: Record<ToastVariant, string> = {
  default: "border border-border bg-card text-card-foreground shadow-lg",
  success: "border border-emerald-500/40 bg-emerald-500/15 text-emerald-900 shadow-lg dark:text-emerald-100",
  destructive: "border border-destructive/40 bg-destructive/10 text-destructive-foreground shadow-lg",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:justify-end">
      <div className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full items-start gap-3 rounded-md p-4 transition",
              variantClasses[toast.variant] ?? variantClasses.default,
            )}
          >
            <div className="flex-1 space-y-1">
              {toast.title ? <p className="text-sm font-semibold leading-none tracking-tight">{toast.title}</p> : null}
              {toast.description ? <p className="text-sm text-muted-foreground">{toast.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
              aria-label="关闭通知"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
