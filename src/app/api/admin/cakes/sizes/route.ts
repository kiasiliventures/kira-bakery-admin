import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { createCakeOption } from "@/lib/cakes/data";
import { cakeOptionCreateSchema } from "@/lib/schemas/cakes";

export const POST = withAdminRoute(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "create_cake_size",
    rateLimit: { limit: 40, windowMs: 60_000 },
  },
  async (request) => {
    const input = await parseJsonBody(request, cakeOptionCreateSchema);
    const size = await createCakeOption("cake_sizes", input);
    return jsonOk({ size }, 201);
  },
);
