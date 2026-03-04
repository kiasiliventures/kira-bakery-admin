import { conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { orderStatusPatchSchema } from "@/lib/schemas/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const PATCH = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "patch_order_status",
    rateLimit: { limit: 80, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const input = await parseJsonBody(request, orderStatusPatchSchema);
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("orders")
      .select("id,order_status,updated_at")
      .eq("id", params.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Order lookup failed: ${existingError.message}`);
    }
    if (!existing) {
      throw notFound("Order not found");
    }

    if (existing.order_status === input.orderStatus) {
      return jsonOk({
        order: existing,
        idempotent: true,
      });
    }

    if (existing.updated_at !== input.updatedAt) {
      throw conflict("Order was modified concurrently");
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({
        order_status: input.orderStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("updated_at", input.updatedAt)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Order status update failed: ${error.message}`);
    }

    return jsonOk({ order: data, idempotent: false });
  },
);

