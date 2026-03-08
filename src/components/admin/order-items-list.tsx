import { getOrderItemOptionsText, getOrderItemPricing, orderCurrencyFormatter } from "@/lib/orders";
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

            return (
              <div
                key={item.id}
                className="flex flex-col gap-1 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{quantity ?? "-"} ×</span> {item.name}
                    {unitPrice !== null ? (
                      <span className="text-slate-500"> - {orderCurrencyFormatter.format(unitPrice)} each</span>
                    ) : null}
                  </p>
                  {options ? <p className="text-xs text-slate-500">{options}</p> : null}
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
