import { jsonOk } from "@/lib/http/responses";
import { getOrders } from "@/lib/supabase/queries";
import { withAdminRoute } from "@/lib/http/admin-route";

function parseLimit(request: Request) {
  const raw = new URL(request.url).searchParams.get("limit");
  const parsed = Number(raw ?? "100");

  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.max(1, Math.min(500, Math.trunc(parsed)));
}

export const GET = withAdminRoute(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "get_admin_orders",
    rateLimit: { limit: 240, windowMs: 60_000 },
  },
  async (request) => {
    const url = new URL(request.url);
    const createdAtGte = url.searchParams.get("createdAtGte") ?? undefined;
    const createdAtLt = url.searchParams.get("createdAtLt") ?? undefined;
    const orders = await getOrders({
      limit: parseLimit(request),
      createdAtGte,
      createdAtLt,
    });
    return jsonOk({ orders });
  },
);
