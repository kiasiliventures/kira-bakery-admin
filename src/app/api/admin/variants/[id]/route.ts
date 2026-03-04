import { conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { variantPatchSchema } from "@/lib/schemas/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const PATCH = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "patch_variant",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const input = await parseJsonBody(request, variantPatchSchema);
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("product_variants")
      .select("id,updated_at")
      .eq("id", params.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Variant lookup failed: ${existingError.message}`);
    }
    if (!existing) {
      throw notFound("Variant not found");
    }
    if (existing.updated_at !== input.updatedAt) {
      throw conflict("Variant was modified concurrently");
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.price !== undefined) updates.price = input.price.toFixed(2);
    if (input.isAvailable !== undefined) updates.is_available = input.isAvailable;
    if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;

    const { data, error } = await supabaseAdmin
      .from("product_variants")
      .update(updates)
      .eq("id", params.id)
      .eq("updated_at", input.updatedAt)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Variant update failed: ${error.message}`);
    }

    return jsonOk({ variant: data });
  },
);

