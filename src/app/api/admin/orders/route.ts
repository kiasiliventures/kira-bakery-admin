import { jsonOk } from "@/lib/http/responses";
import { getOrders } from "@/lib/supabase/queries";
import { withAdminRoute } from "@/lib/http/admin-route";

const DEFAULT_ORDER_LIST_LIMIT = 50;
const MAX_ORDER_LIST_LIMIT = 100;

function parseLimit(request: Request) {
  const raw = new URL(request.url).searchParams.get("limit");
  const parsed = Number(raw ?? String(DEFAULT_ORDER_LIST_LIMIT));

  if (!Number.isFinite(parsed)) {
    return DEFAULT_ORDER_LIST_LIMIT;
  }

  return Math.max(1, Math.min(MAX_ORDER_LIST_LIMIT, Math.trunc(parsed)));
}

function parseDetail(request: Request) {
  return new URL(request.url).searchParams.get("detail") === "detail" ? "detail" : "summary";
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
      detail: parseDetail(request),
    });
    return jsonOk({ orders });
  },
);
