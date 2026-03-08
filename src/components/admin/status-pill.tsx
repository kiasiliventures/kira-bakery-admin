import { cn } from "@/lib/utils";
import type { StatusPillType } from "@/lib/types";

const styles: Record<StatusPillType, string> = {
  Available: "bg-emerald-100 text-emerald-700",
  "Out of Stock": "bg-orange-100 text-orange-700",
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-sky-100 text-sky-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Ready: "bg-emerald-100 text-emerald-700",
  Delivered: "bg-slate-200 text-slate-600",
  Cancelled: "bg-rose-100 text-rose-700",
};

export function StatusPill({ status }: { status: StatusPillType }) {
  return (
    <span className={cn("inline-flex rounded-[10px] px-2.5 py-1 text-xs font-semibold", styles[status])}>
      {status}
    </span>
  );
}
