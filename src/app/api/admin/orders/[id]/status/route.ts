import { badRequest, conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { orderStatusPatchSchema } from "@/lib/schemas/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapTransitionError(message: string) {
  if (message.includes("order not found")) {
    return notFound("Order not found");
  }

  if (message.includes("concurrently")) {
    return conflict("Order was modified concurrently");
  }

  if (message.includes("insufficient stock")) {
    return conflict("Insufficient stock to approve this order");
  }

  return badRequest(message);
}

export const PATCH = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "patch_order_status",
    rateLimit: { limit: 80, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const input = await parseJsonBody(request, orderStatusPatchSchema);
    const supabase = await createSupabaseServerClient();

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

    return jsonOk({ order: data });
  },
);
