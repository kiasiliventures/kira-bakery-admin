import { v4 as uuidv4 } from "uuid";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { variantCreateSchema } from "@/lib/schemas/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const POST = withAdminRoute(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "create_variant",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async (request) => {
    const input = await parseJsonBody(request, variantCreateSchema);
    const supabaseAdmin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("product_variants")
      .insert({
        id: uuidv4(),
        product_id: input.productId,
        name: input.name,
        price: input.price.toFixed(2),
        is_available: input.isAvailable,
        sort_order: input.sortOrder,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Variant insert failed: ${error.message}`);
    }

    return jsonOk({ variant: data }, 201);
  },
);

