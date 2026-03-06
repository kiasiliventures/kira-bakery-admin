"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ToastItem = {
  id: string;
  title: string;
};

type ToastContextValue = {
  push: (title: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((title: string) => {
    const id = crypto.randomUUID();
    setItems((previous) => [...previous, { id, title }]);
    window.setTimeout(() => {
      setItems((previous) => previous.filter((item) => item.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 left-4 z-50 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-kira-border bg-white px-4 py-3 text-sm text-slate-700 shadow-lg"
          >
            {item.title}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  const toast = React.useCallback(
    ({ title }: { title: string }) => context?.push(title),
    [context],
  );

  return {
    toast,
  };
}

export function ToastBanner({
  visible,
  title,
  className,
}: {
  visible: boolean;
  title: string;
  className?: string;
}) {
  if (!visible) return null;
  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-40 rounded-xl border border-kira-border bg-white px-4 py-3 text-sm text-slate-700 shadow-lg",
        className,
      )}
    >
      {title}
    </div>
  );
}
