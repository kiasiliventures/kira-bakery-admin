"use client";

import { cn } from "@/lib/utils";
import type { AnalyticsBucket } from "@/lib/analytics/types";

export function AnalyticsBarChart({
  buckets,
  formatValue,
  compact = false,
  className,
  selectedBucketKey,
  onSelectBucket,
}: {
  buckets: AnalyticsBucket[];
  formatValue: (value: number) => string;
  compact?: boolean;
  className?: string;
  selectedBucketKey?: string | null;
  onSelectBucket?: (bucket: AnalyticsBucket) => void;
}) {
  const maxValue = Math.max(...buckets.map((bucket) => bucket.value), 0);
  const labelStep = compact ? Number.POSITIVE_INFINITY : Math.max(1, Math.ceil(buckets.length / 6));

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("flex items-end gap-1.5", compact ? "h-12" : "h-56")}>
        {buckets.map((bucket) => {
          const ratio = maxValue > 0 ? bucket.value / maxValue : 0;
          const height = compact ? Math.max(ratio * 100, 12) : Math.max(ratio * 100, 4);
          const isSelected = selectedBucketKey === bucket.key;
          const barClassName = cn(
            "w-full rounded-t-[10px] transition-colors",
            onSelectBucket ? "cursor-pointer" : "cursor-default",
            isSelected ? "bg-kira-red shadow-[0_0_0_2px_rgba(148,2,2,0.18)]" : "bg-kira-red/85 hover:bg-kira-red",
            compact ? "min-h-[6px]" : "min-h-[12px]",
          );

          return (
            <div key={bucket.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              {onSelectBucket ? (
                <button
                  type="button"
                  title={`${bucket.label}: ${formatValue(bucket.value)}`}
                  onClick={() => onSelectBucket(bucket)}
                  className={barClassName}
                  style={{ height: `${height}%` }}
                />
              ) : (
                <div
                  title={`${bucket.label}: ${formatValue(bucket.value)}`}
                  className={barClassName}
                  style={{ height: `${height}%` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {compact ? null : (
        <div className="mt-3 flex items-start gap-1.5">
          {buckets.map((bucket, index) => {
            const shouldShow = index % labelStep === 0 || index === buckets.length - 1;
            return (
              <div key={`${bucket.key}-label`} className="min-w-0 flex-1 text-center">
                <span className={cn("text-[11px]", shouldShow ? "text-slate-500" : "text-transparent")}>
                  {bucket.shortLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
