"use client";

import * as React from "react";
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
    <div className="fixed inset-0 z-50 bg-black/30">
      <div
        className={cn(
          "absolute top-0 h-full w-full max-w-md border-l border-kira-border bg-white p-5 shadow-xl",
          side === "right" ? "right-0" : "left-0 border-r border-l-0",
          className,
        )}
      >
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
