import { v4 as uuidv4 } from "uuid";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { productCreateSchema } from "@/lib/schemas/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const POST = withAdminRoute(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "create_product",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (request) => {
    const input = await parseJsonBody(request, productCreateSchema);
    const supabase = await createSupabaseServerClient();

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("products")
      .insert({
        id: uuidv4(),
        category_id: input.categoryId,
        name: input.name,
        description: input.description || null,
        image_url: input.imageUrl || null,
        base_price: input.basePrice.toFixed(2),
        stock_quantity: input.stockQuantity,
        is_available: input.isAvailable,
        is_featured: input.isFeatured,
        is_published: input.isPublished,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Product insert failed: ${error.message}`);
    }

    return jsonOk({ product: data }, 201);
  },
);
