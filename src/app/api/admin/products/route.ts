import { v4 as uuidv4 } from "uuid";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { productBatchCreateSchema, productCreateSchema } from "@/lib/schemas/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const productCreateRequestSchema = z.union([
  productCreateSchema,
  productBatchCreateSchema,
]);

export const POST = withAdminRoute(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "create_product",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (request) => {
    const input = await parseJsonBody(request, productCreateRequestSchema);
    const supabase = await createSupabaseServerClient();

    const now = new Date().toISOString();
    const requestedProducts = "products" in input ? input.products : [input];
    const productsToInsert = requestedProducts.map((product) => {
      const id = uuidv4();

      return {
        clientRequestId: product.clientRequestId ?? null,
        id,
        category_id: product.categoryId,
        name: product.name,
        description: product.description || null,
        image_url: product.imageUrl || null,
        base_price: product.basePrice.toFixed(2),
        stock_quantity: product.stockQuantity,
        is_available: product.isAvailable,
        is_featured: product.isFeatured,
        // New products go live immediately; unpublishing is a separate edit action.
        is_published: true,
        created_at: now,
        updated_at: now,
      };
    });

    const insertPayload = productsToInsert.map((product) => ({
      id: product.id,
      category_id: product.category_id,
      name: product.name,
      description: product.description,
      image_url: product.image_url,
      base_price: product.base_price,
      stock_quantity: product.stock_quantity,
      is_available: product.is_available,
      is_featured: product.is_featured,
      is_published: product.is_published,
      created_at: product.created_at,
      updated_at: product.updated_at,
    }));

    const { data, error } = await supabase
      .from("products")
      .insert(insertPayload)
      .select("*");

    if (error) {
      throw new Error(`Product insert failed: ${error.message}`);
    }

    const createdProducts = productsToInsert.map(({ clientRequestId, id }) => ({
      clientRequestId,
      product: (data ?? []).find((product) => product.id === id) ?? null,
    }));

    return jsonOk(
      {
        product: createdProducts[0]?.product ?? null,
        products: createdProducts,
      },
      201,
    );
  },
);
