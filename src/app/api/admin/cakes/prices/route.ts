import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { createCakePrice } from "@/lib/cakes/data";
import { cakePriceCreateSchema } from "@/lib/schemas/cakes";

export const POST = withAdminRoute(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "create_cake_price",
    rateLimit: { limit: 50, windowMs: 60_000 },
  },
  async (request) => {
    const input = await parseJsonBody(request, cakePriceCreateSchema);
    const price = await createCakePrice(input);
    return jsonOk({ price }, 201);
  },
);
