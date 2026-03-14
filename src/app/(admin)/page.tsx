import { DashboardRecentOrders } from "@/components/admin/dashboard-recent-orders";
import { MetricCard } from "@/components/admin/metric-card";
import { PageShell } from "@/components/admin/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage } from "@/lib/auth/page-guard";
import { getDashboardMetrics, getOrders, getProducts } from "@/lib/supabase/queries";

const trend = [6, 9, 7, 10, 11, 12, 14];
const currencyFormatter = new Intl.NumberFormat("en-UG", {
  style: "currency",
  currency: "UGX",
  maximumFractionDigits: 0,
});

export default async function DashboardPage() {
  const identity = await guardPage(["admin", "manager", "staff"]);
  const [metrics, orders, products] = await Promise.all([
    getDashboardMetrics(),
    getOrders(),
    getProducts(),
  ]);

  const pendingCount = orders.filter((order) => order.status === "Pending Payment").length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.total_ugx, 0);
  const latestProducts = products.slice(0, 4);
  const canUpdateStatus =
    identity.profile.role === "admin" ||
    identity.profile.role === "manager" ||
    identity.profile.role === "staff";

  return (
    <PageShell title="Dashboard Overview">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Orders" value={String(metrics.orderCount)} trendLine={trend} />
        <MetricCard title="Pending Payment" value={String(pendingCount)} trendLine={trend} />
        <MetricCard title="Total Revenue" value={currencyFormatter.format(totalRevenue)} trendLine={trend} />
        <MetricCard title="Total Products" value={String(metrics.productCount)} trendLine={trend} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardRecentOrders orders={orders} canUpdateStatus={canUpdateStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestProducts.map((product) => (
              <div key={product.id} className="flex items-center gap-3 rounded-xl border border-kira-border p-2">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-11 w-11 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-xs text-slate-500">
                    No Img
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
                  <p className="text-xs text-slate-500">
                    Stock: {product.stock_quantity} | {product.is_available ? "Available" : "Unavailable"}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
