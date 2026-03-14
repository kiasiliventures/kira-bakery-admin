"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OrderItemsList } from "@/components/admin/order-items-list";
import { StatusPill } from "@/components/admin/status-pill";
import { useOrdersRealtime } from "@/components/admin/use-orders-realtime";
import { Button } from "@/components/ui/button";
import {
  formatDeliveryMethod,
  formatOrderReference,
  getPrimaryOrderAction,
  orderCurrencyFormatter,
  patchOrderStatus,
  reverifyOrderPayment,
} from "@/lib/orders";
import type { Order } from "@/lib/types/domain";

function formatPaymentStatus(value: string | null): string {
  if (!value) {
    return "Pending";
  }

  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type Props = {
  orders: Order[];
  canUpdateStatus: boolean;
};

export function OrderStatusManager({ orders, canUpdateStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useOrdersRealtime({ source: "OrderStatusManager", showNewOrderToast: true });

  const handleAction = async (order: Order) => {
    const action = getPrimaryOrderAction(order);
    if (!canUpdateStatus || !action || (action.type === "reverify" && action.disabled)) {
      return;
    }

    setLoadingId(order.id);
    setStatus("");

    try {
      if (action.type === "reverify") {
        await reverifyOrderPayment(order);
      } else {
        await patchOrderStatus(order, action.nextStatus);
      }

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
      {orders.map((order) => {
        const action = getPrimaryOrderAction(order);
        const actionDisabled = !canUpdateStatus || !action || (action.type === "reverify" && action.disabled);

        return (
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

            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Order Status</p>
                <div className="mt-2">
                  <StatusPill status={order.status} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Payment</p>
                <p className="mt-1 text-slate-800">{formatPaymentStatus(order.payment_status)}</p>
                {order.paid_at ? (
                  <p className="mt-1 text-xs text-slate-500">Paid at {new Date(order.paid_at).toLocaleString()}</p>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Tracking ID</p>
                <p className="mt-1 break-all text-slate-800">{order.order_tracking_id ?? "Not available yet"}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant={action?.type === "reverify" ? "outline" : "default"}
                loading={loadingId === order.id}
                disabled={actionDisabled}
                onClick={() => void handleAction(order)}
              >
                {action?.label ?? "No actions available"}
              </Button>
              {!action && <span className="text-sm text-slate-500">No staff action needed.</span>}
              {action?.type === "reverify" && action.disabled ? (
                <span className="text-sm text-slate-500">Tracking ID not available yet.</span>
              ) : null}
            </div>
          </div>
        );
      })}
      {status ? <p className="text-sm text-red-600">{status}</p> : null}
    </div>
  );
}
