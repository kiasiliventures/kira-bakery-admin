import { badRequest, conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { logger } from "@/lib/logger";
import { syncOrderPaymentViaStorefront } from "@/lib/payments/storefront";
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
      throw badRequest("Order does not have a payment tracking ID yet");
    }

    logger.info("admin_order_payment_reverify_start", {
      orderId: order.id,
      trackingId: order.order_tracking_id,
      provider: order.payment_provider ?? "unknown",
      currentStatus: order.status,
      paymentStatus: order.payment_status,
    });

    const storefrontOrder = await syncOrderPaymentViaStorefront(order.id);

    const { data: updated, error: updatedError } = await supabaseAdmin
      .from("orders")
      .select(orderSelection)
      .eq("id", params.id)
      .maybeSingle();

    if (updatedError) {
      throw new Error(`Order payment refresh lookup failed: ${updatedError.message}`);
    }

    if (!updated) {
      throw notFound("Order not found");
    }

    const updatedOrder = updated as unknown as OrderPaymentRow;
    const wasUpdated =
      updatedOrder.updated_at !== order.updated_at
      || updatedOrder.payment_status !== order.payment_status
      || updatedOrder.payment_reference !== order.payment_reference
      || updatedOrder.paid_at !== order.paid_at
      || updatedOrder.inventory_deducted_at !== order.inventory_deducted_at;

    if (!wasUpdated && storefrontOrder.paymentStatus === "pending") {
      logger.info("admin_order_payment_reverify_pending", {
        orderId: order.id,
        trackingId: order.order_tracking_id,
        providerStatus: storefrontOrder.providerStatus,
      });

      return jsonOk({
        order: updatedOrder,
        providerStatus: storefrontOrder.providerStatus,
        paymentStatus: storefrontOrder.paymentStatus,
        updated: false,
      });
    }

    const { data: latest, error: latestError } = await supabaseAdmin
      .from("orders")
      .select(orderSelection)
      .eq("id", params.id)
      .maybeSingle();

    if (latestError) {
      throw new Error(`Order payment lookup failed: ${latestError.message}`);
    }

    if (!latest) {
      throw notFound("Order not found");
    }

    const latestOrder = latest as unknown as OrderPaymentRow;

    logger.info("admin_order_payment_reverify_success", {
      orderId: params.id,
      trackingId: order.order_tracking_id,
      paymentStatus: latestOrder.payment_status,
      providerStatus: storefrontOrder.providerStatus,
      inventoryDeductedAt: latestOrder.inventory_deducted_at,
      updated: wasUpdated,
    });

    return jsonOk({
      order: latestOrder,
      providerStatus: storefrontOrder.providerStatus,
      paymentStatus: storefrontOrder.paymentStatus,
      updated: wasUpdated,
    });
  },
);
