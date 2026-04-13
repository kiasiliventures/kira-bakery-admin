import { v4 as uuidv4 } from "uuid";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { categoryCreateSchema } from "@/lib/schemas/admin";
import { triggerStorefrontCatalogRevalidation } from "@/lib/storefront-catalog-revalidation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const POST = withAdminRoute(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "create_category",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async (request) => {
    const input = await parseJsonBody(request, categoryCreateSchema);
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("categories")
      .insert({
        id: uuidv4(),
        name: input.name,
        sort_order: input.sortOrder,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Category insert failed: ${error.message}`);
    }

    const storefrontCacheInvalidation = await triggerStorefrontCatalogRevalidation({
      source: "admin_category_create",
      productIds: [],
    });

    return jsonOk({ category: data, storefrontCacheInvalidation }, 201);
  },
);
