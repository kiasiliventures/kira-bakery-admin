import { badRequest, conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { logger } from "@/lib/logger";
import {
  getPesapalTransactionStatus,
  normalizePesapalPaymentState,
} from "@/lib/payments/pesapal";
import { orderPaymentReverifySchema } from "@/lib/schemas/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OrderPaymentRow = {
  id: string;
  status: string;
  payment_status: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  order_tracking_id: string | null;
  paid_at: string | null;
  inventory_deducted_at: string | null;
  updated_at: string;
};

function normalizeStoredPaymentStatus(paymentStatus: string | null | undefined): string {
  const normalized = paymentStatus?.trim().toLowerCase();
  return normalized || "pending";
}

const orderSelection = [
  "id",
  "status",
  "payment_status",
  "payment_provider",
  "payment_reference",
  "order_tracking_id",
  "paid_at",
  "inventory_deducted_at",
  "updated_at",
].join(",");

export const POST = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "reverify_order_payment",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const input = await parseJsonBody(request, orderPaymentReverifySchema);
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("orders")
      .select(orderSelection)
      .eq("id", params.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Order payment lookup failed: ${existingError.message}`);
    }

    if (!existing) {
      throw notFound("Order not found");
    }

    const order = existing as unknown as OrderPaymentRow;

    if (order.updated_at !== input.updatedAt) {
      throw conflict("Order was modified concurrently");
    }

    if (!order.order_tracking_id) {
      throw badRequest("Order does not have a Pesapal tracking ID yet");
    }

    logger.info("admin_order_payment_reverify_start", {
      orderId: order.id,
      trackingId: order.order_tracking_id,
      currentStatus: order.status,
      paymentStatus: order.payment_status,
    });

    const providerStatus = await getPesapalTransactionStatus(order.order_tracking_id);
    const normalizedProviderStatus = normalizePesapalPaymentState(providerStatus.payment_status_description);
    const storedPaymentStatus = normalizeStoredPaymentStatus(order.payment_status);

    if (normalizedProviderStatus === "pending") {
      logger.info("admin_order_payment_reverify_pending", {
        orderId: order.id,
        trackingId: order.order_tracking_id,
        providerStatus: providerStatus.payment_status_description ?? null,
      });

      return jsonOk({
        order,
        providerStatus: providerStatus.payment_status_description ?? null,
        paymentStatus: storedPaymentStatus,
        updated: false,
      });
    }

    const nextPaymentStatus =
      storedPaymentStatus === "paid" && normalizedProviderStatus !== "paid"
        ? storedPaymentStatus
        : normalizedProviderStatus;

    const updates: Record<string, unknown> = {
      payment_provider: "pesapal",
      payment_status: nextPaymentStatus,
      order_tracking_id: order.order_tracking_id,
      updated_at: new Date().toISOString(),
    };

    if (providerStatus.confirmation_code) {
      updates.payment_reference = providerStatus.confirmation_code;
    }

    if (nextPaymentStatus === "paid") {
      updates.paid_at = order.paid_at ?? new Date().toISOString();
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updates)
      .eq("id", params.id)
      .eq("updated_at", input.updatedAt)
      .select(orderSelection)
      .maybeSingle();

    if (updateError) {
      throw new Error(`Order payment update failed: ${updateError.message}`);
    }

    if (!updated) {
      throw conflict("Order was modified concurrently");
    }

    const updatedOrder = updated as unknown as OrderPaymentRow;

    logger.info("admin_order_payment_reverify_success", {
      orderId: params.id,
      trackingId: order.order_tracking_id,
      storedPaymentStatus,
      nextPaymentStatus,
      providerStatus: providerStatus.payment_status_description ?? null,
      inventoryDeductedAt: updatedOrder.inventory_deducted_at,
    });

    return jsonOk({
      order: updatedOrder,
      providerStatus: providerStatus.payment_status_description ?? null,
      paymentStatus: nextPaymentStatus,
      updated: true,
    });
  },
);
