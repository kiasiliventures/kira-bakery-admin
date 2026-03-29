import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusPillType } from "@/lib/types";

const styles: Record<StatusPillType, string> = {
  Available: "bg-emerald-100 text-emerald-700",
  "Out of Stock": "bg-orange-100 text-orange-700",
  Pending: "bg-amber-100 text-amber-700",
  "Pending Payment": "bg-amber-100 text-amber-700",
  Approved: "bg-sky-100 text-sky-700",
  Paid: "bg-sky-100 text-sky-700",
  "Paid - Needs Review": "bg-amber-100 text-amber-800",
  "Paid - Stock Conflict": "bg-orange-100 text-orange-800",
  "In Progress": "bg-blue-100 text-blue-700",
  Ready: "bg-emerald-100 text-emerald-700",
  Completed: "bg-slate-200 text-slate-600",
  "Payment Failed": "bg-rose-100 text-rose-700",
  Delivered: "bg-slate-200 text-slate-600",
  Cancelled: "bg-rose-100 text-rose-700",
};

export function StatusPill({ status }: { status: StatusPillType }) {
  const showWarningIcon = status === "Paid - Needs Review" || status === "Paid - Stock Conflict";

  return (
    <span className={cn("inline-flex items-center rounded-[10px] px-2.5 py-1 text-xs font-semibold", styles[status])}>
      {showWarningIcon ? <AlertTriangle className="mr-1 h-3.5 w-3.5" /> : null}
      {status}
    </span>
  );
}
