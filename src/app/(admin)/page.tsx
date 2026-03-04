import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage } from "@/lib/auth/page-guard";
import { getDashboardMetrics } from "@/lib/supabase/queries";

export default async function DashboardPage() {
  await guardPage(["admin", "manager", "staff"]);
  const metrics = await getDashboardMetrics();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-slate-900">Overview</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{metrics.orderCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{metrics.productCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{metrics.categoryCount}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

