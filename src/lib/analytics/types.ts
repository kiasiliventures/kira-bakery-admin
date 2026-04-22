export const BUSINESS_TIME_ZONE = "Africa/Kampala";

export type AnalyticsMetric = "revenue" | "orders";

export type AnalyticsTimeframe = "today" | "7d" | "30d" | "3m" | "12m" | "custom";

export type AnalyticsBucketUnit = "hour" | "day" | "week" | "month";

export type LocalDateValue = {
  year: number;
  month: number;
  day: number;
};

export type AnalyticsRange = {
  timeZone: string;
  timeframe: AnalyticsTimeframe;
  label: string;
  bucketUnit: AnalyticsBucketUnit;
  startAt: string;
  endAt: string;
  startDate: LocalDateValue;
  endDateExclusive: LocalDateValue;
};

export type AnalyticsBucket = {
  key: string;
  label: string;
  shortLabel: string;
  startAt: string;
  endAt: string;
  value: number;
};

export type AnalyticsDayValue = {
  key: string;
  date: string;
  label: string;
  startAt: string;
  endAt: string;
  value: number;
};

export type AnalyticsSeries = {
  metric: AnalyticsMetric;
  title: string;
  total: number;
  range: AnalyticsRange;
  buckets: AnalyticsBucket[];
  dayValues: AnalyticsDayValue[];
  generatedAt: string;
};
