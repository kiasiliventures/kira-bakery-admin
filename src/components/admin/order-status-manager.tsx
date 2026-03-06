"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Order } from "@/lib/types/domain";

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">{order.customer_name}</p>
              <p className="text-sm text-slate-500">
                {order.phone ?? "No phone"} | {order.email ?? "No email"}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(order.created_at).toLocaleString()} | {order.delivery_method ?? "pickup"}
              </p>
              {order.address ? (
                <p className="text-xs text-slate-500">{order.address}</p>
              ) : null}
            </div>
            <p className="text-lg font-semibold text-slate-900">UGX {order.total_ugx}</p>
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
