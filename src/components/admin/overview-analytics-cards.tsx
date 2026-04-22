"use client";

import * as React from "react";
import { CalendarDays, ChartColumnIncreasing, Loader2 } from "lucide-react";
import { AnalyticsBarChart } from "@/components/admin/analytics-bar-chart";
import { OrderItemsList } from "@/components/admin/order-items-list";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  formatBusinessDateShort,
  parseLocalDateInput,
} from "@/lib/analytics/date-range";
import {
  BUSINESS_TIME_ZONE,
  type AnalyticsMetric,
  type AnalyticsSeries,
  type AnalyticsTimeframe,
} from "@/lib/analytics/types";
import { formatOrderReference, orderCurrencyFormatter } from "@/lib/orders";
import type { Order } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("en-UG", {
  style: "currency",
  currency: "UGX",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-UG");

const timeframeLabels: Array<{ value: AnalyticsTimeframe; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "3m", label: "3 Months" },
  { value: "12m", label: "12 Months" },
  { value: "custom", label: "Custom Range" },
];

const orderAnalyticsViews = [
  { value: "bar", label: "Bar Chart" },
  { value: "calendar", label: "Calendar" },
] as const;

type OrderAnalyticsView = (typeof orderAnalyticsViews)[number]["value"];
type DaySelection = { date: string; startAt: string; endAt: string };
type OrderDayFilter = "successful" | "issues";

const successfulStatuses = new Set<Order["status"]>(["Paid", "Ready", "Completed"]);
const issueStatuses = new Set<Order["status"]>(["Pending Payment", "Payment Failed", "Cancelled"]);

function formatMetricValue(metric: AnalyticsMetric, value: number): string {
  return metric === "revenue" ? currencyFormatter.format(value) : numberFormatter.format(value);
}

async function fetchAnalyticsSeries(input: {
  metric: AnalyticsMetric;
  timeframe: AnalyticsTimeframe;
  from?: string;
  to?: string;
}): Promise<AnalyticsSeries> {
  const params = new URLSearchParams({
    metric: input.metric,
    timeframe: input.timeframe,
  });

  if (input.from) {
    params.set("from", input.from);
  }

  if (input.to) {
    params.set("to", input.to);
  }

  const response = await fetch(`/api/admin/analytics?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: { series?: AnalyticsSeries }; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.ok || !payload.data?.series) {
    throw new Error(payload?.error?.message ?? "Failed to load analytics");
  }

  return payload.data.series;
}

async function fetchOrdersForDay(input: DaySelection): Promise<Order[]> {
  const params = new URLSearchParams({
    limit: "500",
    createdAtGte: input.startAt,
    createdAtLt: input.endAt,
  });

  const response = await fetch(`/api/admin/orders?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: { orders?: Order[] }; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.ok || !payload.data?.orders) {
    throw new Error(payload?.error?.message ?? "Failed to load orders");
  }

  return payload.data.orders;
}

function getHeatmapIntensityClass(value: number): string {
  if (value <= 0) return "border-kira-red/10 bg-kira-red/5";
  if (value <= 2) return "border-kira-red/20 bg-kira-red/20";
  if (value <= 5) return "border-kira-red/35 bg-kira-red/45";
  return "border-kira-red bg-kira-red";
}

function buildCalendarCells(series: AnalyticsSeries) {
  const first = parseLocalDateInput(series.dayValues[0]?.date);
  const last = parseLocalDateInput(series.dayValues[series.dayValues.length - 1]?.date);

  if (!first || !last) {
    return [];
  }

  const firstWeekday = (new Date(Date.UTC(first.year, first.month - 1, first.day)).getUTCDay() + 6) % 7;
  const lastWeekday = (new Date(Date.UTC(last.year, last.month - 1, last.day)).getUTCDay() + 6) % 7;
  const leading = Array.from({ length: firstWeekday }, (_, index) => ({ key: `leading-${index}`, type: "empty" as const }));
  const trailing = Array.from({ length: 6 - lastWeekday }, (_, index) => ({ key: `trailing-${index}`, type: "empty" as const }));

  return [
    ...leading,
    ...series.dayValues.map((day) => ({ key: day.key, type: "day" as const, day })),
    ...trailing,
  ];
}

function OrderCalendarHeatmap({
  series,
  selectedDay,
  onSelectDay,
}: {
  series: AnalyticsSeries;
  selectedDay: string | null;
  onSelectDay: (value: DaySelection) => void;
}) {
  const cells = buildCalendarCells(series);
  const dayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {dayHeaders.map((day) => (
          <div key={day} className="text-center text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            {day}
          </div>
        ))}

        {cells.map((cell) =>
          cell.type === "empty" ? (
            <div key={cell.key} className="aspect-square rounded-xl border border-transparent" />
          ) : (
            <button
              key={cell.key}
              type="button"
              title={`${cell.day.label}: ${numberFormatter.format(cell.day.value)} orders`}
              onClick={() => onSelectDay({ date: cell.day.date, startAt: cell.day.startAt, endAt: cell.day.endAt })}
              className={cn(
                "aspect-square rounded-xl border transition-transform hover:-translate-y-0.5",
                getHeatmapIntensityClass(cell.day.value),
                selectedDay === cell.day.date ? "ring-2 ring-kira-red/35 ring-offset-2 ring-offset-white" : "",
              )}
            >
              <span className="sr-only">{cell.day.label}</span>
            </button>
          ),
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>Less</span>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-[4px] border border-kira-red/10 bg-kira-red/5" />
          <span className="h-3 w-3 rounded-[4px] border border-kira-red/20 bg-kira-red/20" />
          <span className="h-3 w-3 rounded-[4px] border border-kira-red/35 bg-kira-red/45" />
          <span className="h-3 w-3 rounded-[4px] border border-kira-red bg-kira-red" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

function getDaySelectionForBucket(series: AnalyticsSeries, bucketKey: string): DaySelection | null {
  const bucket = series.buckets.find((candidate) => candidate.key === bucketKey);
  if (!bucket) {
    return null;
  }

  const matchingDay = series.dayValues.find(
    (day) => day.startAt >= bucket.startAt && day.startAt < bucket.endAt,
  );

  if (!matchingDay) {
    return null;
  }

  return {
    date: matchingDay.date,
    startAt: matchingDay.startAt,
    endAt: matchingDay.endAt,
  };
}

function SelectedDayOrdersPanel({
  selectedDay,
  selectedDayOrders,
  loading,
  errorMessage,
}: {
  selectedDay: DaySelection;
  selectedDayOrders: Order[];
  loading: boolean;
  errorMessage: string | null;
}) {
  const [activeFilter, setActiveFilter] = React.useState<OrderDayFilter>("successful");

  React.useEffect(() => {
    setActiveFilter("successful");
  }, [selectedDay.date]);

  const selectedDayDate = parseLocalDateInput(selectedDay.date);
  const successfulOrders = selectedDayOrders.filter((order) => successfulStatuses.has(order.status));
  const issueOrders = selectedDayOrders.filter((order) => issueStatuses.has(order.status));
  const visibleOrders = activeFilter === "successful" ? successfulOrders : issueOrders;

  return (
    <div className="mt-6 rounded-2xl border border-kira-border bg-slate-50 p-4">
      <div>
        <p className="text-sm font-medium text-slate-900">
          Orders for {selectedDayDate ? formatBusinessDateShort(selectedDayDate) : selectedDay.date}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {numberFormatter.format(selectedDayOrders.length)} orders created on {selectedDay.date} in {BUSINESS_TIME_ZONE}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveFilter("successful")}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            activeFilter === "successful" ? "bg-kira-red text-white" : "bg-white text-slate-600 hover:bg-slate-100",
          )}
        >
          Successful ({successfulOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("issues")}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            activeFilter === "issues" ? "bg-kira-red text-white" : "bg-white text-slate-600 hover:bg-slate-100",
          )}
        >
          Issues ({issueOrders.length})
        </button>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading day orders...
        </div>
      ) : null}
      {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

      {!loading && !errorMessage ? (
        visibleOrders.length > 0 ? (
          <div className="mt-4 space-y-4">
            {visibleOrders.map((order) => (
              <div key={order.id} className="rounded-xl border border-kira-border bg-white px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{formatOrderReference(order.id)}</p>
                      <StatusPill status={order.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{order.customer_name}</p>
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    <p>{new Date(order.created_at).toLocaleTimeString("en-UG", { hour: "numeric", minute: "2-digit" })}</p>
                    <p className="mt-1 font-medium text-slate-800">{orderCurrencyFormatter.format(order.total_ugx)}</p>
                  </div>
                </div>
                <OrderItemsList items={order.items} heading="Order items" className="mt-4" />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            {activeFilter === "successful"
              ? "No successful orders were created on this day."
              : "No issue orders were created on this day."}
          </p>
        )
      ) : null}
    </div>
  );
}

function OverviewAnalyticsCard({
  title,
  value,
  rangeLabel,
  buckets,
  onClick,
  formatValue,
}: {
  title: string;
  value: string;
  rangeLabel: string;
  buckets: AnalyticsSeries["buckets"];
  onClick: () => void;
  formatValue: (value: number) => string;
}) {
  return (
    <button type="button" className="text-left" onClick={onClick}>
      <Card className="transition-transform duration-150 hover:-translate-y-0.5">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-500">
            <span>{title}</span>
            <ChartColumnIncreasing className="h-4 w-4 text-kira-red" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-3xl font-semibold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">
              {rangeLabel} in {BUSINESS_TIME_ZONE}
            </p>
          </div>
          <AnalyticsBarChart buckets={buckets} formatValue={formatValue} compact />
        </CardContent>
      </Card>
    </button>
  );
}

export function OverviewAnalyticsCards({
  initialRevenueSeries,
  initialOrdersSeries,
}: {
  initialRevenueSeries: AnalyticsSeries;
  initialOrdersSeries: AnalyticsSeries;
}) {
  const initialToday = initialRevenueSeries.range.startDate;
  const initialDateValue = `${String(initialToday.year).padStart(4, "0")}-${String(initialToday.month).padStart(2, "0")}-${String(initialToday.day).padStart(2, "0")}`;
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedMetric, setSelectedMetric] = React.useState<AnalyticsMetric>("revenue");
  const [timeframe, setTimeframe] = React.useState<AnalyticsTimeframe>("today");
  const [draftFrom, setDraftFrom] = React.useState(initialDateValue);
  const [draftTo, setDraftTo] = React.useState(initialDateValue);
  const [appliedCustomRange, setAppliedCustomRange] = React.useState({ from: initialDateValue, to: initialDateValue });
  const [orderView, setOrderView] = React.useState<OrderAnalyticsView>("bar");
  const [selectedDay, setSelectedDay] = React.useState<DaySelection | null>(null);
  const [selectedBarKey, setSelectedBarKey] = React.useState<string | null>(null);
  const [seriesCache, setSeriesCache] = React.useState<Record<string, AnalyticsSeries>>({
    "revenue:today": initialRevenueSeries,
    "orders:today": initialOrdersSeries,
  });
  const [dayOrdersCache, setDayOrdersCache] = React.useState<Record<string, Order[]>>({});
  const [loading, startTransition] = React.useTransition();
  const [loadingDayOrders, startDayOrdersTransition] = React.useTransition();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [dayOrdersError, setDayOrdersError] = React.useState<string | null>(null);

  const selectedCacheKey =
    timeframe === "custom"
      ? `${selectedMetric}:${timeframe}:${appliedCustomRange.from}:${appliedCustomRange.to}`
      : `${selectedMetric}:${timeframe}`;

  const selectedSeries =
    seriesCache[selectedCacheKey] ??
    (selectedMetric === "revenue" ? initialRevenueSeries : initialOrdersSeries);
  const selectedDayOrders = selectedDay ? dayOrdersCache[selectedDay.date] ?? [] : [];

  const requestSeries = React.useEffectEvent((metric: AnalyticsMetric, nextTimeframe: AnalyticsTimeframe, from?: string, to?: string) => {
    const cacheKey = nextTimeframe === "custom" ? `${metric}:${nextTimeframe}:${from}:${to}` : `${metric}:${nextTimeframe}`;

    if (seriesCache[cacheKey]) {
      return;
    }

    startTransition(async () => {
      try {
        setErrorMessage(null);
        const series = await fetchAnalyticsSeries({
          metric,
          timeframe: nextTimeframe,
          from,
          to,
        });

        setSeriesCache((current) => ({
          ...current,
          [cacheKey]: series,
        }));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load analytics");
      }
    });
  });

  const requestDayOrders = React.useEffectEvent((day: DaySelection) => {
    if (dayOrdersCache[day.date]) {
      return;
    }

    startDayOrdersTransition(async () => {
      try {
        setDayOrdersError(null);
        const orders = await fetchOrdersForDay(day);
        setDayOrdersCache((current) => ({
          ...current,
          [day.date]: orders,
        }));
      } catch (error) {
        setDayOrdersError(error instanceof Error ? error.message : "Failed to load day orders");
      }
    });
  });

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (timeframe === "custom") {
      requestSeries(selectedMetric, timeframe, appliedCustomRange.from, appliedCustomRange.to);
      return;
    }

    requestSeries(selectedMetric, timeframe);
  }, [appliedCustomRange.from, appliedCustomRange.to, isOpen, selectedMetric, timeframe]);

  React.useEffect(() => {
    setSelectedDay(null);
    setSelectedBarKey(null);
    setDayOrdersError(null);
  }, [selectedCacheKey, selectedMetric, orderView]);

  function openMetric(metric: AnalyticsMetric) {
    setSelectedMetric(metric);
    setTimeframe("today");
    setOrderView("bar");
    setSelectedDay(null);
    setSelectedBarKey(null);
    setErrorMessage(null);
    setDayOrdersError(null);
    setIsOpen(true);
  }

  const customRangeInvalid = draftFrom.length === 0 || draftTo.length === 0 || draftFrom > draftTo;

  return (
    <>
      <OverviewAnalyticsCard
        title="Total Orders"
        value={formatMetricValue("orders", initialOrdersSeries.total)}
        rangeLabel="Today"
        buckets={initialOrdersSeries.buckets}
        onClick={() => openMetric("orders")}
        formatValue={(value) => formatMetricValue("orders", value)}
      />
      <OverviewAnalyticsCard
        title="Revenue"
        value={formatMetricValue("revenue", initialRevenueSeries.total)}
        rangeLabel="Today"
        buckets={initialRevenueSeries.buckets}
        onClick={() => openMetric("revenue")}
        formatValue={(value) => formatMetricValue("revenue", value)}
      />

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full max-w-4xl overflow-y-auto p-0">
          <div className="flex min-h-full flex-col">
            <SheetHeader className="border-b border-kira-border px-6 py-5">
              <SheetTitle className="text-xl">{selectedSeries.title} analytics</SheetTitle>
              <p className="mt-1 text-sm text-slate-500">
                {selectedSeries.range.label} in {BUSINESS_TIME_ZONE}
              </p>
            </SheetHeader>

            <div className="space-y-6 px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                {timeframeLabels.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={timeframe === option.value ? "default" : "outline"}
                    onClick={() => {
                      setTimeframe(option.value);
                      setErrorMessage(null);
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              {timeframe === "custom" ? (
                <div className="rounded-2xl border border-kira-border bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-slate-700">From</span>
                      <Input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-slate-700">To</span>
                      <Input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} />
                    </label>
                    <Button
                      type="button"
                      onClick={() => {
                        setAppliedCustomRange({ from: draftFrom, to: draftTo });
                        setErrorMessage(null);
                      }}
                      disabled={customRangeInvalid}
                    >
                      Apply range
                    </Button>
                  </div>
                  {customRangeInvalid ? (
                    <p className="mt-2 text-xs text-red-600">Choose a valid date range where the start is on or before the end.</p>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-3xl border border-kira-border bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Current total</p>
                    <p className="mt-2 text-4xl font-semibold text-slate-900">
                      {formatMetricValue(selectedMetric, selectedSeries.total)}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">{selectedSeries.range.label}</p>
                  </div>

                  {selectedMetric === "orders" ? (
                    <div className="inline-flex rounded-2xl border border-kira-border bg-slate-50 p-1">
                      {orderAnalyticsViews.map((view) => (
                        <button
                          key={view.value}
                          type="button"
                          onClick={() => setOrderView(view.value)}
                          className={cn(
                            "rounded-[12px] px-3 py-2 text-sm font-medium transition-colors",
                            orderView === view.value ? "bg-kira-red text-white" : "text-slate-600 hover:bg-white",
                          )}
                        >
                          {view.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-kira-border bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-kira-red" />
                        <span>{selectedSeries.range.bucketUnit} bars</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  {selectedMetric === "orders" && orderView === "calendar" ? (
                    <OrderCalendarHeatmap
                      series={selectedSeries}
                      selectedDay={selectedDay?.date ?? null}
                      onSelectDay={(day) => {
                        setSelectedBarKey(null);
                        setSelectedDay(day);
                        requestDayOrders(day);
                      }}
                    />
                  ) : (
                    <AnalyticsBarChart
                      buckets={selectedSeries.buckets}
                      formatValue={(value) => formatMetricValue(selectedMetric, value)}
                      selectedBucketKey={selectedMetric === "orders" ? selectedBarKey : null}
                      onSelectBucket={
                        selectedMetric === "orders"
                          ? (bucket) => {
                              const nextDay = getDaySelectionForBucket(selectedSeries, bucket.key);
                              setSelectedBarKey(bucket.key);
                              if (!nextDay) {
                                setSelectedDay(null);
                                return;
                              }
                              setSelectedDay(nextDay);
                              requestDayOrders(nextDay);
                            }
                          : undefined
                      }
                    />
                  )}
                </div>

                {loading ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refreshing analytics...
                  </div>
                ) : null}
                {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

                {selectedMetric === "orders" && selectedDay ? (
                  <SelectedDayOrdersPanel
                    selectedDay={selectedDay}
                    selectedDayOrders={selectedDayOrders}
                    loading={loadingDayOrders}
                    errorMessage={dayOrdersError}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
