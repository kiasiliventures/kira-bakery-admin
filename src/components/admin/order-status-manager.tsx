"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Order, OrderItem } from "@/lib/types/domain";

type Props = {
  orders: Order[];
  canUpdateStatus: boolean;
};

const statusOptions = [
  "Pending",
  "In Progress",
  "Ready",
  "Delivered",
] as const;

const currencyFormatter = new Intl.NumberFormat("en-UG", {
  style: "currency",
  currency: "UGX",
  maximumFractionDigits: 0,
});

function formatOrderReference(orderId: string): string {
  return `Order #${orderId}`;
}

function titleCaseDeliveryMethod(method: Order["delivery_method"]): string {
  if (!method) return "Pickup";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

function buildItemOptions(item: OrderItem): string | null {
  const parts = [item.selected_size, item.selected_flavor].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  if (parts.length > 0) {
    return parts.join(", ");
  }

  const variantName = item.variant_name?.trim();
  if (!variantName) {
    return null;
  }

  return variantName !== item.name ? variantName : null;
}

function getItemPricing(item: OrderItem): {
  quantity: number | null;
  unitPrice: number | null;
  subtotal: number | null;
} {
  const quantity = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : null;
  const unitPrice =
    Number.isFinite(item.price_ugx) && item.price_ugx >= 0
      ? item.price_ugx
      : item.price_at_time !== null && Number.isFinite(item.price_at_time) && item.price_at_time >= 0
        ? item.price_at_time
        : null;

  return {
    quantity,
    unitPrice,
    subtotal: quantity !== null && unitPrice !== null ? quantity * unitPrice : unitPrice,
  };
}

export function OrderStatusManager({ orders, canUpdateStatus }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("admin-orders-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          toast({ title: "New order received." });
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, toast]);

  const updateStatus = async (order: Order, nextStatus: string) => {
    if (!canUpdateStatus) return;
    setLoadingId(order.id);
    setStatus("");
    const response = await fetch(`/api/admin/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderStatus: nextStatus,
        updatedAt: order.updated_at,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to update order status");
      setLoadingId(null);
      return;
    }
    router.refresh();
    setLoadingId(null);
  };

  if (orders.length === 0) {
    return <p className="text-sm text-slate-500">No orders found in the database.</p>;
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="break-all text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                {formatOrderReference(order.id)}
              </p>
              <p className="font-medium text-slate-900">{order.customer_name}</p>
              <p className="text-sm text-slate-500">
                {order.phone ?? "No phone"} | {order.email ?? "No email"}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(order.created_at).toLocaleString()} |{" "}
                {titleCaseDeliveryMethod(order.delivery_method)}
              </p>
              {order.address ? (
                <p className="text-xs text-slate-500">{order.address}</p>
              ) : null}
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Total</p>
              <p className="text-lg font-semibold text-slate-900">
                {currencyFormatter.format(order.total_ugx)}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-sm font-medium text-slate-900">Items</p>
            {order.items.length > 0 ? (
              <div className="mt-3 space-y-3">
                {order.items.map((item) => {
                  const { quantity, unitPrice, subtotal } = getItemPricing(item);
                  const options = buildItemOptions(item);

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-1 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800">
                          <span className="font-medium">{quantity ?? "-"} ×</span> {item.name}
                          {unitPrice !== null ? (
                            <span className="text-slate-500">
                              {" "}
                              - {currencyFormatter.format(unitPrice)} each
                            </span>
                          ) : null}
                        </p>
                        {options ? <p className="text-xs text-slate-500">{options}</p> : null}
                      </div>
                      {subtotal !== null ? (
                        <p className="shrink-0 text-sm font-medium text-slate-700">
                          {currencyFormatter.format(subtotal)}
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              defaultValue={order.status}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
              disabled={!canUpdateStatus || loadingId === order.id}
              onChange={(event) => updateStatus(order, event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
      {status ? <p className="text-sm text-red-600">{status}</p> : null}
    </div>
  );
}
