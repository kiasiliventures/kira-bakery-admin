import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function TrendLine({ points }: { points: number[] }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const scaled = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = max === min ? 50 : 100 - ((point - min) / (max - min)) * 80 - 10;
    return `${x},${y}`;
  });
  return (
    <svg viewBox="0 0 100 100" className="h-10 w-full">
      <polyline points={scaled.join(" ")} fill="none" stroke="#940202" strokeWidth="3" opacity="0.28" />
    </svg>
  );
}

export function MetricCard({
  title,
  value,
  trendLine,
}: {
  title: string;
  value: string;
  trendLine?: number[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-semibold text-slate-900">{value}</p>
        {trendLine ? <TrendLine points={trendLine} /> : null}
      </CardContent>
    </Card>
  );
}
