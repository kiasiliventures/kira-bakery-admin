import { isAdminOrderBlockedForReview } from "@/lib/order-display-state";
import type { Order, OrderItem } from "@/lib/types/domain";

export type PendingTrackedPaymentsReconcileStats = {
  scanned: number;
  verified: number;
  updated: number;
  skipped: number;
  skippedRecentlyVerified: number;
  skippedOverCap: number;
  errors: number;
  verifiedOrderIds: string[];
  updatedOrderIds: string[];
  skippedOrderIds: string[];
  errorOrderIds: string[];
};

export const orderCurrencyFormatter = new Intl.NumberFormat("en-UG", {
  style: "currency",
  currency: "UGX",
  maximumFractionDigits: 0,
});

const orderStatusOptions: Record<Order["status"], Order["status"][]> = {
  "Pending Payment": ["Pending Payment"],
  Paid: ["Paid", "Ready"],
  "Paid - Needs Review": ["Paid - Needs Review"],
  "Paid - Stock Conflict": ["Paid - Stock Conflict"],
  Ready: ["Ready", "Completed"],
  Completed: ["Completed"],
  "Payment Failed": ["Payment Failed"],
  Cancelled: ["Cancelled"],
};

export function getOrderStatusOptions(status: Order["status"]): Order["status"][] {
  return orderStatusOptions[status];
}

export function getPrimaryOrderAction(
  order: Pick<Order, "status" | "order_tracking_id">,
):
  | { type: "reverify"; label: string; disabled: boolean }
  | { type: "transition"; label: string; nextStatus: Extract<Order["status"], "Ready" | "Completed"> }
  | null {
  if (order.status === "Pending Payment") {
    return {
      type: "reverify",
      label: "Reverify payment status",
      disabled: !order.order_tracking_id,
    };
  }

  if (order.status === "Paid") {
    return {
      type: "transition",
      label: "Mark ready",
      nextStatus: "Ready",
    };
  }

  if (isAdminOrderBlockedForReview(order.status)) {
    return null;
  }

  if (order.status === "Ready") {
    return {
      type: "transition",
      label: "Mark completed",
      nextStatus: "Completed",
    };
  }

  return null;
}

export function formatOrderReference(orderId: string): string {
  return `Order #${orderId}`;
}

export function formatDeliveryMethod(method: Order["delivery_method"]): string {
  return method === "delivery" ? "Delivery" : "Pickup";
}

export function getOrderItemOptionsText(item: OrderItem): string | null {
  const parts = [item.selected_size, item.selected_flavor].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  if (parts.length > 0) {
    return parts.join(", ");
  }

  const variantName = item.variant_name?.trim();
  if (!variantName || variantName === item.name) {
    return null;
  }

  return variantName;
}

export function getOrderItemPricing(item: OrderItem): {
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

export function formatInventoryAllocationStatus(
  status: OrderItem["inventory_allocation_status"],
): string | null {
  if (status === "allocated") {
    return "Inventory secured";
  }

  if (status === "partial_conflict") {
    return "Partial stock conflict";
  }

  if (status === "conflict") {
    return "Stock conflict";
  }

  if (status === "pending") {
    return "Pending allocation";
  }

  return null;
}

export async function fetchAdminOrderById(orderId: string): Promise<Order | null> {
  const response = await fetch(`/api/admin/orders/${orderId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: { order?: Order | null }; error?: { message?: string } }
    | null;

  if (response.status === 404) {
    return null;
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message ?? "Failed to fetch order");
  }

  return payload.data?.order ?? null;
}

type FetchAdminOrdersOptions = {
  limit?: number;
  detail?: "summary" | "detail";
};

export async function fetchAdminOrders(options: number | FetchAdminOrdersOptions = {}): Promise<Order[]> {
  const limit = typeof options === "number" ? options : options.limit;
  const detail = typeof options === "number" ? undefined : options.detail;
  const normalizedLimit = Math.max(1, Math.min(100, Math.trunc(limit ?? 50)));
  const params = new URLSearchParams({ limit: String(normalizedLimit) });

  if (detail === "detail") {
    params.set("detail", "detail");
  }

  const response = await fetch(`/api/admin/orders?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: { orders?: Order[] }; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message ?? "Failed to fetch orders");
  }

  return payload.data?.orders ?? [];
}

export async function patchOrderStatus(
  order: Pick<Order, "id" | "updated_at">,
  nextStatus: Order["status"],
): Promise<void> {
  const response = await fetch(`/api/admin/orders/${order.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderStatus: nextStatus,
      updatedAt: order.updated_at,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Failed to update order status");
  }
}

export async function reverifyOrderPayment(
  order: Pick<Order, "id" | "updated_at">,
): Promise<void> {
  const response = await fetch(`/api/admin/orders/${order.id}/reverify-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updatedAt: order.updated_at,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Failed to reverify payment status");
  }
}

export async function reconcilePendingTrackedPayments(): Promise<PendingTrackedPaymentsReconcileStats> {
  const response = await fetch("/api/admin/orders/reconcile-pending-payments", {
    method: "POST",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: { stats?: PendingTrackedPaymentsReconcileStats }; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.ok || !payload.data?.stats) {
    throw new Error(payload?.error?.message ?? "Failed to reconcile pending payments");
  }

  return payload.data.stats;
}
