"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type SheetContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  return <SheetContext.Provider value={{ open, onOpenChange }}>{children}</SheetContext.Provider>;
}

export function SheetTrigger({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(SheetContext);
  if (!context) return null;
  return (
    <button type="button" onClick={() => context.onOpenChange(true)} {...props}>
      {children}
    </button>
  );
}

export function SheetContent({
  className,
  side = "right",
  children,
}: {
  className?: string;
  side?: "right" | "left";
  children: React.ReactNode;
}) {
  const context = React.useContext(SheetContext);
  if (!context?.open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={() => context.onOpenChange(false)}>
      <div
        className={cn(
          "absolute top-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] max-w-md rounded-2xl bg-white p-5 shadow-xl",
          side === "right"
            ? "right-2 border border-kira-border"
            : "left-2 border border-kira-border",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close panel"
          onClick={() => context.onOpenChange(false)}
          className="absolute top-4 right-4 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-kira-border bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
          <span>Close</span>
        </button>
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold text-slate-900", className)} {...props} />;
}
