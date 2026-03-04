import { conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { categoryPatchSchema } from "@/lib/schemas/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const PATCH = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "patch_category",
    rateLimit: { limit: 40, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const input = await parseJsonBody(request, categoryPatchSchema);
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("categories")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Category lookup failed: ${existingError.message}`);
    }

    if (!existing) {
      throw notFound("Category not found");
    }

    if (existing.created_at !== input.updatedAt) {
      throw conflict("Category was modified concurrently");
    }

    const updates: Record<string, unknown> = {};
    if (typeof input.name === "string") {
      updates.name = input.name;
    }
    if (typeof input.sortOrder === "number") {
      updates.sort_order = input.sortOrder;
    }

    const { data, error } = await supabaseAdmin
      .from("categories")
      .update(updates)
      .eq("id", params.id)
      .eq("created_at", input.updatedAt)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Category update failed: ${error.message}`);
    }

    return jsonOk({ category: data });
  },
);

