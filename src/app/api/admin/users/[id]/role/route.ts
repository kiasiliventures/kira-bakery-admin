import { badRequest, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { userRolePatchSchema } from "@/lib/schemas/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const PATCH = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin"],
    actionName: "patch_user_role",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async (request, { identity, params }) => {
    const input = await parseJsonBody(request, userRolePatchSchema);
    if (identity.user.id === params.id && input.role !== "admin") {
      throw badRequest("You cannot remove your own admin role");
    }

    const supabase = await createSupabaseServerClient();
    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", params.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Profile lookup failed: ${existingError.message}`);
    }
    if (!existing) {
      throw notFound("Profile not found");
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ role: input.role })
      .eq("id", params.id)
      .select("id,email,role,created_at")
      .single();

    if (error) {
      throw new Error(`Role update failed: ${error.message}`);
    }

    return jsonOk({ profile: data });
  },
);
