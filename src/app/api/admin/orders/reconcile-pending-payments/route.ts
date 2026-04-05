import { jsonOk } from "@/lib/http/responses";
import { withAdminRoute } from "@/lib/http/admin-route";
import { logger } from "@/lib/logger";
import { reconcilePendingTrackedPayments } from "@/lib/payments/reverify";

export const POST = withAdminRoute(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "reconcile_pending_tracked_payments",
    rateLimit: { limit: 24, windowMs: 60_000 },
  },
  async () => {
    const stats = await reconcilePendingTrackedPayments();

    logger.info("admin_pending_tracked_payments_reconciled", stats);

    return jsonOk({ stats });
  },
);
