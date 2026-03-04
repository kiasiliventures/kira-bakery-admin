import { v4 as uuidv4 } from "uuid";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { categoryCreateSchema } from "@/lib/schemas/admin";

export const POST = withAdminRoute(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "create_category",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async (request) => {
    const input = await parseJsonBody(request, categoryCreateSchema);
    const supabaseAdmin = createSupabaseAdminClient();

    const { data, error } = await supabaseAdmin
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

    return jsonOk({ category: data }, 201);
  },
);

