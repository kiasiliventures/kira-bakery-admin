import { conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { orderStatusPatchSchema } from "@/lib/schemas/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function toLegacyOrderStatus(status: string): string {
  if (status === "Pending") return "pending";
  if (status === "In Progress") return "preparing";
  if (status === "Ready") return "ready_for_pickup";
  return "completed";
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

    const modern = await supabase
      .from("orders")
      .select("id,status,updated_at")
      .eq("id", params.id)
      .maybeSingle();

    if (modern.error?.code !== "42703") {
      if (modern.error) {
        throw new Error(`Order lookup failed: ${modern.error.message}`);
      }

      const existing = modern.data;
      if (!existing) {
        throw notFound("Order not found");
      }

      if (existing.status === input.orderStatus) {
        return jsonOk({
          order: existing,
          idempotent: true,
        });
      }

      if (existing.updated_at !== input.updatedAt) {
        throw conflict("Order was modified concurrently");
      }

      const { data, error } = await supabase
        .from("orders")
        .update({
          status: input.orderStatus,
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
    }

    const legacy = await supabase
      .from("orders")
      .select("id,order_status,updated_at")
      .eq("id", params.id)
      .maybeSingle();

    if (legacy.error) {
      throw new Error(`Order lookup failed: ${legacy.error.message}`);
    }

    const existing = legacy.data;
    if (!existing) {
      throw notFound("Order not found");
    }

    const nextLegacyStatus = toLegacyOrderStatus(input.orderStatus);
    if (existing.order_status === nextLegacyStatus) {
      return jsonOk({
        order: existing,
        idempotent: true,
      });
    }

    if (existing.updated_at !== input.updatedAt) {
      throw conflict("Order was modified concurrently");
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        order_status: nextLegacyStatus,
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
