"use client";

import * as React from "react";

export type ToastVariant = "default" | "success" | "destructive";

export interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  duration?: number;
  variant?: ToastVariant;
}

export interface ToastInstance extends ToastOptions {
  id: string;
  createdAt: number;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastInstance[];
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const DEFAULT_DURATION = 4000;
const MAX_VISIBLE_TOASTS = 3;

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastInstance[]>([]);
  const timersRef = React.useRef<Map<string, number>>(new Map());

  const dismiss = React.useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));

    const timeoutId = timersRef.current.get(id);

    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timersRef.current.delete(id);
    }
  }, []);

  const clear = React.useCallback(() => {
    timersRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const { id: providedId, duration = DEFAULT_DURATION, variant = "default", ...rest } = options;
      const id = providedId ?? generateId();

      setToasts((previous) => {
        const existingIndex = previous.findIndex((item) => item.id === id);
        const nextToast: ToastInstance = {
          id,
          createdAt: Date.now(),
          variant,
          duration,
          ...rest,
        };

        if (existingIndex >= 0) {
          const next = [...previous];
          next[existingIndex] = { ...next[existingIndex], ...nextToast };
          return next;
        }

        const next = [...previous, nextToast];

        if (next.length > MAX_VISIBLE_TOASTS) {
          next.shift();
        }

        return next;
      });

      if (duration > 0) {
        const existingTimeout = timersRef.current.get(id);

        if (existingTimeout) {
          window.clearTimeout(existingTimeout);
        }

        const timeoutId = window.setTimeout(() => {
          dismiss(id);
        }, duration);

        timersRef.current.set(id, timeoutId);
      }

      return id;
    },
    [dismiss],
  );

  React.useEffect(() => () => clear(), [clear]);

  const value = React.useMemo(
    () => ({
      toasts,
      toast,
      dismiss,
      clear,
    }),
    [toasts, toast, dismiss, clear],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}
