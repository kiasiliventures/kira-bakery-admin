import { MetricCard } from "@/components/admin/metric-card";
import { PageShell } from "@/components/admin/page-shell";
import { StatusPill } from "@/components/admin/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { guardPage } from "@/lib/auth/page-guard";
import { getDashboardMetrics, getOrders, getProducts } from "@/lib/supabase/queries";

const trend = [6, 9, 7, 10, 11, 12, 14];
const currencyFormatter = new Intl.NumberFormat("en-UG", {
  style: "currency",
  currency: "UGX",
  maximumFractionDigits: 0,
});

export default async function DashboardPage() {
  await guardPage(["admin", "manager", "staff"]);
  const [metrics, orders, products] = await Promise.all([
    getDashboardMetrics(),
    getOrders(),
    getProducts(),
  ]);

  const pendingCount = orders.filter((order) => order.status === "Pending").length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.total_ugx, 0);
  const recentOrders = orders.slice(0, 6);
  const latestProducts = products.slice(0, 4);

  return (
    <PageShell title="Dashboard Overview">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Orders" value={String(metrics.orderCount)} trendLine={trend} />
        <MetricCard title="Pending Orders" value={String(pendingCount)} trendLine={trend} />
        <MetricCard title="Total Revenue" value={currencyFormatter.format(totalRevenue)} trendLine={trend} />
        <MetricCard title="Total Products" value={String(metrics.productCount)} trendLine={trend} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => {
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium text-slate-800">{order.id}</TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>
                          {order.status === "Cancelled" ? (
                            <span className="inline-flex rounded-[10px] bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                              Cancelled
                            </span>
                          ) : (
                            <StatusPill status={order.status} />
                          )}
                        </TableCell>
                        <TableCell>{currencyFormatter.format(order.total_ugx)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
