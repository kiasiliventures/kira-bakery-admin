import { badRequest } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { getAnalyticsSeries } from "@/lib/analytics/queries";
import { parseLocalDateInput } from "@/lib/analytics/date-range";
import type { AnalyticsMetric, AnalyticsTimeframe } from "@/lib/analytics/types";

const allowedMetrics = new Set<AnalyticsMetric>(["revenue", "orders"]);
const allowedTimeframes = new Set<AnalyticsTimeframe>(["today", "7d", "30d", "3m", "12m", "custom"]);

export const GET = withAdminRoute(
  {
    allowedRoles: ["admin", "manager", "staff"],
    actionName: "get_admin_analytics",
    rateLimit: { limit: 240, windowMs: 60_000 },
  },
  async (request) => {
    const url = new URL(request.url);
    const metric = url.searchParams.get("metric") as AnalyticsMetric | null;
    const timeframe = url.searchParams.get("timeframe") as AnalyticsTimeframe | null;

    if (!metric || !allowedMetrics.has(metric)) {
      throw badRequest("Invalid analytics metric.");
    }

    if (!timeframe || !allowedTimeframes.has(timeframe)) {
      throw badRequest("Invalid analytics timeframe.");
    }

    const from = parseLocalDateInput(url.searchParams.get("from"));
    const to = parseLocalDateInput(url.searchParams.get("to"));

    if (timeframe === "custom" && (!from || !to)) {
      throw badRequest("Custom analytics ranges require both from and to dates.");
    }

    const series = await getAnalyticsSeries({
      metric,
      timeframe,
      from: from ?? undefined,
      to: to ?? undefined,
    });

    return jsonOk({ series });
  },
);
