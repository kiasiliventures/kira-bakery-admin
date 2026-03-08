"use client";

import { useState } from "react";
import { ChevronDown, Clock3, MapPin, MoreHorizontal, Store } from "lucide-react";
import { useRouter } from "next/navigation";
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
  formatDeliveryMethod,
  formatOrderReference,
  orderCurrencyFormatter,
  patchOrderStatus,
} from "@/lib/orders";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types/domain";

type Props = {
  orders: Order[];
  canUpdateStatus: boolean;
};

export function DashboardRecentOrders({ orders, canUpdateStatus }: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  useOrdersRealtime({ showNewOrderToast: true });

  const recentOrders = orders.slice(0, 6);

  const handleAction = async (order: Order, nextStatus: Extract<Order["status"], "Approved" | "Cancelled">) => {
    if (!canUpdateStatus || order.status !== "Pending") {
      return;
    }

    setLoadingId(order.id);
    setStatusMessage("");

    try {
      await patchOrderStatus(order, nextStatus);
      router.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to update order status");
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
        const isPending = order.status === "Pending";
        const isLoading = loadingId === order.id;

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
                  className="w-40"
                >
                  <DropdownMenuItem
                    disabled={!isPending || !canUpdateStatus || isLoading}
                    className={!isPending || !canUpdateStatus ? "text-slate-400 hover:bg-white" : undefined}
                    onClick={() => void handleAction(order, "Approved")}
                  >
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!isPending || !canUpdateStatus || isLoading}
                    className={
                      !isPending || !canUpdateStatus
                        ? "text-slate-400 hover:bg-white"
                        : "text-rose-700 hover:bg-rose-50"
                    }
                    onClick={() => void handleAction(order, "Cancelled")}
                  >
                    Cancel
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
                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
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
                    {order.delivery_method === "delivery" && order.address ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
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
