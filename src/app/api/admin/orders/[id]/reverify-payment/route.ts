import { writeAdminAuditLog } from "@/lib/audit/admin-audit";
import { conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { logger } from "@/lib/logger";
import {
  getOrderPaymentRecord,
  reverifyOrderPayment,
} from "@/lib/payments/reverify";
import { orderPaymentReverifySchema } from "@/lib/schemas/admin";

export const POST = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "reverify_order_payment",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async (request, { identity, ip, params }) => {
    const input = await parseJsonBody(request, orderPaymentReverifySchema);
    const existing = await getOrderPaymentRecord(params.id);

    if (!existing) {
      throw notFound("Order not found");
    }

    const order = existing;

    if (order.updated_at !== input.updatedAt) {
      throw conflict("Order was modified concurrently");
    }

    logger.info("admin_order_payment_reverify_start", {
      orderId: order.id,
      trackingId: order.order_tracking_id,
      provider: order.payment_provider ?? "unknown",
      currentStatus: order.status,
      paymentStatus: order.payment_status,
    });

    try {
      const result = await reverifyOrderPayment(order);
      const updatedOrder = result.order;
      const wasUpdated = result.updated;

      if (!wasUpdated && result.paymentStatus === "pending") {
        logger.info("admin_order_payment_reverify_pending", {
          orderId: order.id,
          trackingId: order.order_tracking_id,
          providerStatus: result.providerStatus,
        });

        await writeAdminAuditLog({
          actorUserId: identity.user.id,
          actorRole: identity.profile.role,
          requestIp: ip,
          action: "order_payment_reverify",
          entityType: "order",
          entityId: params.id,
          outcome: "pending",
          details: {
            trackingId: order.order_tracking_id,
            providerStatus: result.providerStatus,
            paymentStatus: result.paymentStatus,
            updated: false,
          },
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
        fulfillmentReviewRequired: updatedOrder.fulfillment_review_required,
        inventoryConflict: updatedOrder.inventory_conflict,
        inventoryDeductionStatus: updatedOrder.inventory_deduction_status,
        updated: wasUpdated,
      });

      await writeAdminAuditLog({
        actorUserId: identity.user.id,
        actorRole: identity.profile.role,
        requestIp: ip,
        action: "order_payment_reverify",
        entityType: "order",
        entityId: params.id,
        outcome: wasUpdated ? "succeeded" : "noop",
        details: {
          trackingId: order.order_tracking_id,
          providerStatus: result.providerStatus,
          paymentStatus: result.paymentStatus,
          updated: wasUpdated,
          inventoryDeductedAt: updatedOrder.inventory_deducted_at,
          fulfillmentReviewRequired: updatedOrder.fulfillment_review_required,
          inventoryConflict: updatedOrder.inventory_conflict,
          inventoryDeductionStatus: updatedOrder.inventory_deduction_status,
        },
      });

      return jsonOk({
        order: updatedOrder,
        providerStatus: result.providerStatus,
        paymentStatus: result.paymentStatus,
        updated: wasUpdated,
      });
    } catch (error) {
      const mapped = error instanceof Error ? error : new Error("unknown_error");

      await writeAdminAuditLog({
        actorUserId: identity.user.id,
        actorRole: identity.profile.role,
        requestIp: ip,
        action: "order_payment_reverify",
        entityType: "order",
        entityId: params.id,
        outcome: "failed",
        details: {
          trackingId: order.order_tracking_id,
          currentPaymentStatus: order.payment_status,
          expectedUpdatedAt: input.updatedAt,
          error: mapped.message,
        },
      });

      throw error;
    }
  },
);
