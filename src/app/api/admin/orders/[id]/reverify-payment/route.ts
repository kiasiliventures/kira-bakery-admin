import { badRequest, conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { logger } from "@/lib/logger";
import {
  getOrderPaymentRecord,
  reverifyPesapalOrderPayment,
} from "@/lib/payments/reverify";
import { orderPaymentReverifySchema } from "@/lib/schemas/admin";

export const POST = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "reverify_order_payment",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const input = await parseJsonBody(request, orderPaymentReverifySchema);
    const existing = await getOrderPaymentRecord(params.id);

    if (!existing) {
      throw notFound("Order not found");
    }

    const order = existing;

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

    const result = await reverifyPesapalOrderPayment(order);
    const updatedOrder = result.order;
    const wasUpdated = result.updated;

    if (!wasUpdated && result.paymentStatus === "pending") {
      logger.info("admin_order_payment_reverify_pending", {
        orderId: order.id,
        trackingId: order.order_tracking_id,
        providerStatus: result.providerStatus,
      });

      return jsonOk({
        order: updatedOrder,
        providerStatus: result.providerStatus,
        paymentStatus: result.paymentStatus,
        updated: false,
      });
    }

    logger.info("admin_order_payment_reverify_success", {
      orderId: params.id,
      trackingId: order.order_tracking_id,
      paymentStatus: updatedOrder.payment_status,
      providerStatus: result.providerStatus,
      inventoryDeductedAt: updatedOrder.inventory_deducted_at,
      updated: wasUpdated,
    });

    return jsonOk({
      order: updatedOrder,
      providerStatus: result.providerStatus,
      paymentStatus: result.paymentStatus,
      updated: wasUpdated,
    });
  },
);
