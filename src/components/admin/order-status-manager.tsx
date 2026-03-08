"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OrderItemsList } from "@/components/admin/order-items-list";
import { StatusPill } from "@/components/admin/status-pill";
import { useOrdersRealtime } from "@/components/admin/use-orders-realtime";
import {
  formatDeliveryMethod,
  formatOrderReference,
  getOrderStatusOptions,
  orderCurrencyFormatter,
  patchOrderStatus,
} from "@/lib/orders";
import type { Order } from "@/lib/types/domain";

type Props = {
  orders: Order[];
  canUpdateStatus: boolean;
};

export function OrderStatusManager({ orders, canUpdateStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useOrdersRealtime({ source: "OrderStatusManager", showNewOrderToast: true });

  const updateStatus = async (order: Order, nextStatus: Order["status"]) => {
    if (!canUpdateStatus) return;
    setLoadingId(order.id);
    setStatus("");

    try {
      await patchOrderStatus(order, nextStatus);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update order status");
    } finally {
      setLoadingId(null);
    }
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
                {new Date(order.created_at).toLocaleString()} | {formatDeliveryMethod(order.delivery_method)}
              </p>
              {order.address ? (
                <p className="text-xs text-slate-500">{order.address}</p>
              ) : null}
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Total</p>
              <p className="text-lg font-semibold text-slate-900">
                {orderCurrencyFormatter.format(order.total_ugx)}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <OrderItemsList items={order.items} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill status={order.status} />
            <select
              defaultValue={order.status}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
              disabled={
                !canUpdateStatus ||
                loadingId === order.id ||
                getOrderStatusOptions(order.status).length < 2
              }
              onChange={(event) => updateStatus(order, event.target.value as Order["status"])}
            >
              {getOrderStatusOptions(order.status).map((option) => (
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
