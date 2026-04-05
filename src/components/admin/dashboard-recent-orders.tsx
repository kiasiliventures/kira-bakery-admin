"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Clock3, MapPin, MoreHorizontal, Store } from "lucide-react";
import { OrderItemsList } from "@/components/admin/order-items-list";
import { StatusPill } from "@/components/admin/status-pill";
import { useOrdersRealtime } from "@/components/admin/use-orders-realtime";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  fetchAdminOrders,
  fetchAdminOrderById,
  formatDeliveryMethod,
  formatOrderReference,
  getPrimaryOrderAction,
  orderCurrencyFormatter,
  patchOrderStatus,
  reconcilePendingTrackedPayments,
  reverifyOrderPayment,
} from "@/lib/orders";
import type { OrdersRealtimeEvent } from "@/lib/orders-realtime";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types/domain";

const RECENT_ORDER_LIMIT = 6;
const RECONCILE_DEBOUNCE_MS = 150;
const AUTO_REVERIFY_INTERVAL_MS = 5 * 60_000;

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

function formatInitiationFailureTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

type Props = {
  orders: Order[];
  canUpdateStatus: boolean;
};

export function DashboardRecentOrders({ orders, canUpdateStatus }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [recentOrders, setRecentOrders] = useState<Order[]>(() => orders.slice(0, RECENT_ORDER_LIMIT));
  const reconcileTimeoutsRef = useRef<Map<string, number>>(new Map());
  const autoReverifyInFlightRef = useRef(false);

  useEffect(() => {
    setRecentOrders(orders.slice(0, RECENT_ORDER_LIMIT));
  }, [orders]);

  const upsertRecentOrder = (order: Order) => {
    setRecentOrders((current) =>
      [order, ...current.filter((candidate) => candidate.id !== order.id)]
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .slice(0, RECENT_ORDER_LIMIT),
    );
  };

  const removeRecentOrder = (orderId: string) => {
    setRecentOrders((current) => current.filter((order) => order.id !== orderId));
    setExpandedId((current) => (current === orderId ? null : current));
  };

  const refreshRecentOrders = async () => {
    const nextOrders = await fetchAdminOrders(RECENT_ORDER_LIMIT);
    setRecentOrders(nextOrders.slice(0, RECENT_ORDER_LIMIT));
  };

  const reconcileOrder = async (orderId: string) => {
    const order = await fetchAdminOrderById(orderId);

    if (!order) {
      removeRecentOrder(orderId);
      return;
    }

    upsertRecentOrder(order);
  };

  const scheduleReconcile = (event: OrdersRealtimeEvent) => {
    if (event.type === "DELETE" && event.orderId) {
      removeRecentOrder(event.orderId);
      return;
    }

    if (!event.orderId) {
      void refreshRecentOrders();
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

  useEffect(() => {
    if (!canUpdateStatus) {
      return;
    }

    let cancelled = false;

    const runAutoReverify = async () => {
      if (cancelled || document.visibilityState !== "visible" || autoReverifyInFlightRef.current) {
        return;
      }

      autoReverifyInFlightRef.current = true;
      try {
        const stats = await reconcilePendingTrackedPayments();
        if (stats.verified > 0 || stats.updated > 0) {
          await refreshRecentOrders();
        }
      } catch {
        // Keep the dashboard quiet on background retries; manual action still exists.
      } finally {
        autoReverifyInFlightRef.current = false;
      }
    };

    void runAutoReverify();
    const intervalId = window.setInterval(() => {
      void runAutoReverify();
    }, AUTO_REVERIFY_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [canUpdateStatus]);

  useOrdersRealtime({
    source: "DashboardRecentOrders",
    autoRefresh: false,
    refreshOnFallback: false,
    onInsert: scheduleReconcile,
    onRefresh: scheduleReconcile,
  });

  const handleAction = async (order: Order) => {
    const action = getPrimaryOrderAction(order);
    if (!canUpdateStatus || !action || (action.type === "reverify" && action.disabled)) {
      return;
    }

    setLoadingId(order.id);
    setStatusMessage("");

    try {
      if (action.type === "reverify") {
        await reverifyOrderPayment(order);
      } else {
        await patchOrderStatus(order, action.nextStatus);
      }

      await reconcileOrder(order.id);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to update order");
    } finally {
      setLoadingId(null);
    }
  };

  if (recentOrders.length === 0) {
    return <p className="text-sm text-slate-500">No orders found in the database.</p>;
  }

  return (
    <div className="space-y-3">
      {recentOrders.map((order) => {
        const isExpanded = expandedId === order.id;
        const isLoading = loadingId === order.id;
        const primaryAction = getPrimaryOrderAction(order);
        const actionDisabled = !canUpdateStatus || !primaryAction || (primaryAction.type === "reverify" && primaryAction.disabled);

        return (
          <article key={order.id} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start gap-2 p-3 sm:p-4">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
                onClick={() => {
                  setStatusMessage("");
                  setExpandedId((current) => (current === order.id ? null : order.id));
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {formatOrderReference(order.id)}
                    </p>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{order.customer_name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(order.created_at).toLocaleString()}
                    </span>
                    <span>{orderCurrencyFormatter.format(order.total_ugx)}</span>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                    isExpanded ? "rotate-180" : "rotate-0",
                  )}
                />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-slate-200 text-slate-500 hover:bg-slate-100"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  aria-label={`Order actions for ${order.id}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  onClick={(event) => event.stopPropagation()}
                  className="w-56"
                >
                  <DropdownMenuItem
                    disabled={actionDisabled || isLoading}
                    className={actionDisabled ? "text-slate-400 hover:bg-white" : undefined}
                    onClick={() => void handleAction(order)}
                  >
                    {primaryAction?.label ?? "No actions available"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div
              className={cn(
                "grid transition-all duration-200 ease-out",
                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="border-t border-slate-200 px-3 pb-4 pt-3 sm:px-4">
                  <OrderItemsList items={order.items} />
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
                  {order.payment_initiation_failure_message ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                      <p className="font-semibold">Pesapal initiation rejected</p>
                      {order.payment_initiation_failure_code ? (
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-amber-700">
                          Code: {order.payment_initiation_failure_code}
                        </p>
                      ) : null}
                      <p className="mt-1">{order.payment_initiation_failure_message}</p>
                      {formatInitiationFailureTimestamp(order.payment_initiation_failed_at) ? (
                        <p className="mt-1 text-xs text-amber-700">
                          Recorded {formatInitiationFailureTimestamp(order.payment_initiation_failed_at)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                        Fulfillment
                      </p>
                      <p className="mt-1 inline-flex items-center gap-2 text-slate-800">
                        {order.delivery_method === "delivery" ? (
                          <MapPin className="h-4 w-4 text-slate-400" />
                        ) : (
                          <Store className="h-4 w-4 text-slate-400" />
                        )}
                        {formatDeliveryMethod(order.delivery_method)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                        Payment
                      </p>
                      <p className="mt-1 text-slate-800">{formatPaymentStatus(order.payment_status)}</p>
                      {order.paid_at ? (
                        <p className="mt-1 text-xs text-slate-500">Paid at {new Date(order.paid_at).toLocaleString()}</p>
                      ) : null}
                    </div>
                    {order.order_tracking_id ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                          Tracking ID
                        </p>
                        <p className="mt-1 break-all text-slate-800">{order.order_tracking_id}</p>
                      </div>
                    ) : null}
                    {order.delivery_method === "delivery" && order.address ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2 xl:col-span-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                          Address
                        </p>
                        <p className="mt-1 text-slate-800">{order.address}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </article>
        );
      })}

      {statusMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
}
