import { conflict, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { productPatchSchema } from "@/lib/schemas/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const PATCH = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "patch_product",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const input = await parseJsonBody(request, productPatchSchema);
    const supabase = await createSupabaseServerClient();

    const { data: existing, error: existingError } = await supabase
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
    if (typeof input.basePrice === "number") updates.base_price = input.basePrice.toFixed(2);
    if (typeof input.stockQuantity === "number") updates.stock_quantity = input.stockQuantity;
    if (typeof input.isAvailable === "boolean") updates.is_available = input.isAvailable;
    if (typeof input.isFeatured === "boolean") updates.is_featured = input.isFeatured;
    if (typeof input.isPublished === "boolean") updates.is_published = input.isPublished;

    const { data, error } = await supabase
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

export const DELETE = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "delete_product",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async (_request, { params }) => {
    const supabase = await createSupabaseServerClient();
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: product, error: productLookupError } = await supabase
      .from("products")
      .select("id,name")
      .eq("id", params.id)
      .maybeSingle();

    if (productLookupError) {
      throw new Error(`Product lookup failed: ${productLookupError.message}`);
    }
    if (!product) {
      throw notFound("Product not found");
    }

    const { count: orderItemCount, error: orderItemLookupError } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", params.id);

    if (orderItemLookupError) {
      throw new Error(`Order usage lookup failed: ${orderItemLookupError.message}`);
    }

    if ((orderItemCount ?? 0) > 0) {
      const { data: retiredProduct, error: retireError } = await supabase
        .from("products")
        .update({
          is_published: false,
          is_available: false,
          stock_quantity: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id)
        .select("*")
        .single();

      if (retireError) {
        throw new Error(`Product retire failed: ${retireError.message}`);
      }

      return jsonOk({
        deleted: false,
        archived: true,
        productId: params.id,
        product: retiredProduct,
        message: `"${product.name}" has order history, so it was unpublished instead of deleted.`,
      });
    }

    const imageFolder = `products/${params.id}`;
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from("product-images")
      .list(imageFolder, { limit: 1000 });

    if (listError) {
      throw new Error(`Image listing failed: ${listError.message}`);
    }

    if (files && files.length > 0) {
      const paths = files
        .filter((file) => file.name)
        .map((file) => `${imageFolder}/${file.name}`);
      const { error: removeError } = await supabaseAdmin.storage
        .from("product-images")
        .remove(paths);
      if (removeError) {
        throw new Error(`Image delete failed: ${removeError.message}`);
      }
    }

    const { error: variantDeleteError } = await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", params.id);

    if (variantDeleteError) {
      throw new Error(`Variant delete failed: ${variantDeleteError.message}`);
    }

    const { error: productDeleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", params.id);

    if (productDeleteError) {
      throw new Error(`Product delete failed: ${productDeleteError.message}`);
    }

    return jsonOk({
      deleted: true,
      archived: false,
      productId: params.id,
      message: `"${product.name}" was deleted.`,
    });
  },
);
