import type { Order, OrderItem } from "@/lib/types/domain";

export const orderCurrencyFormatter = new Intl.NumberFormat("en-UG", {
  style: "currency",
  currency: "UGX",
  maximumFractionDigits: 0,
});

const orderStatusOptions: Record<Order["status"], Order["status"][]> = {
  Pending: ["Pending", "Approved", "Cancelled"],
  Approved: ["Approved", "Ready"],
  Ready: ["Ready"],
  Cancelled: ["Cancelled"],
};

export function getOrderStatusOptions(status: Order["status"]): Order["status"][] {
  return orderStatusOptions[status];
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
