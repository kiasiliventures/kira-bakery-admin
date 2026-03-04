import { conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { productPatchSchema } from "@/lib/schemas/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const PATCH = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "patch_product",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const input = await parseJsonBody(request, productPatchSchema);
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("products")
      .select("id,updated_at")
      .eq("id", params.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Product lookup failed: ${existingError.message}`);
    }
    if (!existing) {
      throw notFound("Product not found");
    }
    if (existing.updated_at !== input.updatedAt) {
      throw conflict("Product was modified concurrently");
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.categoryId) updates.category_id = input.categoryId;
    if (typeof input.name === "string") updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description || null;
    if (input.imageUrl !== undefined) updates.image_url = input.imageUrl || null;
    if (typeof input.isAvailable === "boolean") updates.is_available = input.isAvailable;
    if (typeof input.isFeatured === "boolean") updates.is_featured = input.isFeatured;
    if (typeof input.isPublished === "boolean") updates.is_published = input.isPublished;

    const { data, error } = await supabaseAdmin
      .from("products")
      .update(updates)
      .eq("id", params.id)
      .eq("updated_at", input.updatedAt)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Product update failed: ${error.message}`);
    }

    return jsonOk({ product: data });
  },
);

