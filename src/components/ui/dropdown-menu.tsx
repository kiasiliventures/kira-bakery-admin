"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex">{children}</div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(DropdownContext);
  if (!context) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={() => context.setOpen(!context.open)}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  className,
  align = "end",
  children,
}: {
  className?: string;
  align?: "start" | "end";
  children: React.ReactNode;
}) {
  const context = React.useContext(DropdownContext);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!context?.open) return;
    const handler = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        context.setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [context]);

  if (!context?.open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-11 z-50 min-w-40 rounded-xl border border-kira-border bg-white p-1 shadow-lg",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  className,
  onClick,
  children,
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(DropdownContext);
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center rounded-[10px] px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        context?.setOpen(false);
      }}
    >
      {children}
    </button>
  );
}
