import { notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { getOrderById } from "@/lib/supabase/queries";

export const GET = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "get_admin_order",
    rateLimit: { limit: 240, windowMs: 60_000 },
  },
  async (_request, { params }) => {
    const order = await getOrderById(params.id);

    if (!order) {
      throw notFound("Order not found");
    }

    return jsonOk({ order });
  },
);
