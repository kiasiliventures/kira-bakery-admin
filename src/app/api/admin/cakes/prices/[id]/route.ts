import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { updateCakePrice } from "@/lib/cakes/data";
import { cakePricePatchSchema } from "@/lib/schemas/cakes";

export const PATCH = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "patch_cake_price",
    rateLimit: { limit: 80, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const input = await parseJsonBody(request, cakePricePatchSchema);
    const price = await updateCakePrice(params.id, input);
    return jsonOk({ price });
  },
);
