import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  formatInventoryAllocationStatus,
  getOrderItemOptionsText,
  getOrderItemPricing,
  orderCurrencyFormatter,
} from "@/lib/orders";
import type { OrderItem } from "@/lib/types/domain";

type Props = {
  items: OrderItem[];
  heading?: string;
  className?: string;
};

export function OrderItemsList({ items, heading = "Items", className }: Props) {
  return (
    <div className={className}>
      <p className="text-sm font-medium text-slate-900">{heading}</p>
      {items.length > 0 ? (
        <div className="mt-3 space-y-3">
          {items.map((item) => {
            const { quantity, unitPrice, subtotal } = getOrderItemPricing(item);
            const options = getOrderItemOptionsText(item);
            const inventoryStatus = formatInventoryAllocationStatus(item.inventory_allocation_status);
            const hasInventoryConflict =
              item.inventory_allocation_status === "partial_conflict"
              || item.inventory_allocation_status === "conflict";

            return (
              <div
                key={item.id}
                className="flex flex-col gap-1 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{quantity ?? "-"} x</span> {item.name}
                    {unitPrice !== null ? (
                      <span className="text-slate-500"> - {orderCurrencyFormatter.format(unitPrice)} each</span>
                    ) : null}
                  </p>
                  {options ? <p className="text-xs text-slate-500">{options}</p> : null}
                  {inventoryStatus ? (
                    <p
                      className={
                        hasInventoryConflict
                          ? "mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-700"
                          : "mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700"
                      }
                    >
                      {hasInventoryConflict ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {inventoryStatus}
                      {item.inventory_conflict_quantity > 0
                        ? ` (${item.inventory_conflict_quantity} item${item.inventory_conflict_quantity === 1 ? "" : "s"} conflicted)`
                        : ""}
                    </p>
                  ) : null}
                  {item.inventory_conflict_reason ? (
                    <p className="mt-1 text-xs text-orange-700">{item.inventory_conflict_reason}</p>
                  ) : null}
                </div>
                {subtotal !== null ? (
                  <p className="shrink-0 text-sm font-medium text-slate-700">
                    {orderCurrencyFormatter.format(subtotal)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No order items found.</p>
      )}
    </div>
  );
}
