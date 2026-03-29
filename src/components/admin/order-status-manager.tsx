"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { OrderItemsList } from "@/components/admin/order-items-list";
import { StatusPill } from "@/components/admin/status-pill";
import { useOrdersRealtime } from "@/components/admin/use-orders-realtime";
import { Button } from "@/components/ui/button";
import {
  fetchAdminOrderById,
  formatDeliveryMethod,
  formatOrderReference,
  getPrimaryOrderAction,
  orderCurrencyFormatter,
  patchOrderStatus,
  reverifyOrderPayment,
} from "@/lib/orders";
import type { OrdersRealtimeEvent } from "@/lib/orders-realtime";
import type { Order } from "@/lib/types/domain";

const RECONCILE_DEBOUNCE_MS = 150;

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
  const [localOrders, setLocalOrders] = useState<Order[]>(orders);
  const [status, setStatus] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const reconcileTimeoutsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  const upsertOrder = (order: Order) => {
    setLocalOrders((current) =>
      [order, ...current.filter((candidate) => candidate.id !== order.id)]
        .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    );
  };

  const removeOrder = (orderId: string) => {
    setLocalOrders((current) => current.filter((order) => order.id !== orderId));
  };

  const reconcileOrder = async (orderId: string) => {
    const order = await fetchAdminOrderById(orderId);

    if (!order) {
      removeOrder(orderId);
      return;
    }

    upsertOrder(order);
  };

  const scheduleReconcile = (event: OrdersRealtimeEvent) => {
    if (event.type === "DELETE" && event.orderId) {
      removeOrder(event.orderId);
      return;
    }

    if (!event.orderId) {
      router.refresh();
      return;
    }

    if (reconcileTimeoutsRef.current.has(event.orderId)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      reconcileTimeoutsRef.current.delete(event.orderId!);
      void reconcileOrder(event.orderId!);
    }, RECONCILE_DEBOUNCE_MS);

    reconcileTimeoutsRef.current.set(event.orderId, timeoutId);
  };

  useEffect(() => {
    return () => {
      for (const timeoutId of reconcileTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }

      reconcileTimeoutsRef.current.clear();
    };
  }, []);

  useOrdersRealtime({
    source: "OrderStatusManager",
    showNewOrderToast: true,
    autoRefresh: false,
    refreshOnFallback: true,
    onInsert: scheduleReconcile,
    onRefresh: scheduleReconcile,
  });

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

      await reconcileOrder(order.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update order status");
    } finally {
      setLoadingId(null);
    }
  };

  if (localOrders.length === 0) {
    return <p className="text-sm text-slate-500">No orders found in the database.</p>;
  }

  return (
    <div className="space-y-4">
      {localOrders.map((order) => {
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

            {order.fulfillment_review_required ? (
              <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-sm text-orange-800">
                <p className="inline-flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  {order.inventory_conflict ? "Paid order has a stock conflict" : "Paid order needs review"}
                </p>
                <p className="mt-1">
                  {order.fulfillment_review_reason ?? "Payment succeeded, but fulfillment needs operator review before the order can move forward."}
                </p>
              </div>
            ) : null}

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
              {!action && (
                <span className="text-sm text-slate-500">
                  {order.fulfillment_review_required
                    ? "Resolve the fulfillment review before moving this order to Ready."
                    : "No staff action needed."}
                </span>
              )}
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
