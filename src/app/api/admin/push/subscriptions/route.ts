import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { logger } from "@/lib/logger";
import { adminPushSubscriptionSchema } from "@/lib/schemas/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const POST = withAdminRoute(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "register_admin_push_subscription",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (request, { identity }) => {
    const input = await parseJsonBody(request, adminPushSubscriptionSchema);
    const supabaseAdmin = createSupabaseAdminClient();
    const timestamp = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("admin_push_subscriptions")
      .upsert(
        {
          user_id: identity.user.id,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          last_seen_at: timestamp,
          updated_at: timestamp,
        },
        {
          onConflict: "endpoint",
        },
      )
      .select("id,endpoint,user_id,last_seen_at")
      .single();

    if (error) {
      throw new Error(`Unable to save admin push subscription: ${error.message}`);
    }

    logger.info("admin_push_subscription_registered", {
      userId: identity.user.id,
      subscriptionId: data.id,
      endpoint: data.endpoint,
    });

    return jsonOk({
      subscriptionId: data.id,
      endpoint: data.endpoint,
      userId: data.user_id,
      lastSeenAt: data.last_seen_at,
    });
  },
);
