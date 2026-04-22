import { describe, expect, it } from "vitest";
import { buildAnalyticsBuckets, buildAnalyticsRange, formatLocalDateInput } from "@/lib/analytics/date-range";

describe("analytics date ranges", () => {
  it("builds today using the Africa/Kampala business day", () => {
    const range = buildAnalyticsRange({
      timeframe: "today",
      now: new Date("2026-04-21T22:30:00.000Z"),
    });

    expect(formatLocalDateInput(range.startDate)).toBe("2026-04-22");
    expect(range.startAt).toBe("2026-04-21T21:00:00.000Z");
    expect(range.endAt).toBe("2026-04-22T21:00:00.000Z");
    expect(range.bucketUnit).toBe("hour");
  });

  it("uses monthly buckets for the 12 month view", () => {
    const range = buildAnalyticsRange({
      timeframe: "12m",
      now: new Date("2026-04-22T10:00:00.000Z"),
    });

    const buckets = buildAnalyticsBuckets(range);

    expect(formatLocalDateInput(range.startDate)).toBe("2025-05-01");
    expect(range.bucketUnit).toBe("month");
    expect(buckets).toHaveLength(12);
  });

  it("chooses sensible custom buckets based on span", () => {
    const shortRange = buildAnalyticsRange({
      timeframe: "custom",
      from: { year: 2026, month: 4, day: 20 },
      to: { year: 2026, month: 4, day: 21 },
    });
    const longerRange = buildAnalyticsRange({
      timeframe: "custom",
      from: { year: 2026, month: 1, day: 1 },
      to: { year: 2026, month: 8, day: 31 },
    });

    expect(shortRange.bucketUnit).toBe("hour");
    expect(longerRange.bucketUnit).toBe("month");
  });
});
