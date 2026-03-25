import { writeAdminAuditLog } from "@/lib/audit/admin-audit";
import { badRequest, conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { orderStatusPatchSchema } from "@/lib/schemas/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapTransitionError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("order not found")) {
    return notFound("Order not found");
  }

  if (normalized.includes("concurrently")) {
    return conflict("Order was modified concurrently");
  }

  if (normalized.includes("insufficient stock")) {
    return conflict("Insufficient stock to complete this payment transition");
  }

  if (normalized.includes("only paid orders can move to ready")) {
    return badRequest("Only paid orders can be marked ready");
  }

  if (normalized.includes("only ready orders can move to completed")) {
    return badRequest("Only ready orders can be marked completed");
  }

  if (normalized.includes("only admin or manager can cancel orders")) {
    return badRequest("Only admin or manager can cancel orders");
  }

  if (normalized.includes("completed orders cannot be cancelled")) {
    return badRequest("Completed orders cannot be cancelled");
  }

  return badRequest(message);
}

export const PATCH = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "patch_order_status",
    rateLimit: { limit: 80, windowMs: 60_000 },
  },
  async (request, { identity, ip, params }) => {
    const input = await parseJsonBody(request, orderStatusPatchSchema);
    const supabase = await createSupabaseServerClient();

    try {
      const { data, error } = await supabase.rpc("admin_transition_order_status", {
        p_order_id: params.id,
        p_next_status: input.orderStatus,
        p_expected_updated_at: input.updatedAt,
      });

      if (error) {
        throw mapTransitionError(error.message);
      }

      if (!data) {
        throw notFound("Order not found");
      }

      await writeAdminAuditLog({
        actorUserId: identity.user.id,
        actorRole: identity.profile.role,
        requestIp: ip,
        action: "order_status_transition",
        entityType: "order",
        entityId: params.id,
        outcome: "succeeded",
        details: {
          requestedStatus: input.orderStatus,
          expectedUpdatedAt: input.updatedAt,
          resultingStatus: (data as { status?: string | null }).status ?? null,
        },
      });

      return jsonOk({ order: data });
    } catch (error) {
      const mapped = error instanceof Error ? error : new Error("unknown_error");

      await writeAdminAuditLog({
        actorUserId: identity.user.id,
        actorRole: identity.profile.role,
        requestIp: ip,
        action: "order_status_transition",
        entityType: "order",
        entityId: params.id,
        outcome: "failed",
        details: {
          requestedStatus: input.orderStatus,
          expectedUpdatedAt: input.updatedAt,
          error: mapped.message,
        },
      });

      throw error;
    }
  },
);
