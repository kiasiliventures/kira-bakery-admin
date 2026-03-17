import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { updateCakeOption } from "@/lib/cakes/data";
import { cakeOptionPatchSchema } from "@/lib/schemas/cakes";

export const PATCH = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "patch_cake_topping",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const input = await parseJsonBody(request, cakeOptionPatchSchema);
    const topping = await updateCakeOption("cake_toppings", params.id, input);
    return jsonOk({ topping });
  },
);
