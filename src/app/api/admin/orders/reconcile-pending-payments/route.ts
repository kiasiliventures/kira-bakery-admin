import { jsonOk } from "@/lib/http/responses";
import { withAdminRoute } from "@/lib/http/admin-route";
import { logger } from "@/lib/logger";
import { reconcilePendingTrackedPayments } from "@/lib/payments/reverify";
import { processAdminPushDispatchQueue } from "@/lib/push/admin-paid-order-notifications";

export const POST = withAdminRoute(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "reconcile_pending_tracked_payments",
    rateLimit: { limit: 24, windowMs: 60_000 },
  },
  async () => {
    const stats = await reconcilePendingTrackedPayments();
    const adminPushProcessing = await processAdminPushDispatchQueue({
      limit: Math.max(1, Math.min(stats.updated || 1, 10)),
    });

    logger.info("admin_pending_tracked_payments_reconciled", {
      ...stats,
      adminPushProcessing,
    });

    return jsonOk({ stats, adminPushProcessing });
  },
);
