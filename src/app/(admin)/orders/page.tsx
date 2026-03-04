import { OrderStatusManager } from "@/components/admin/order-status-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage } from "@/lib/auth/page-guard";
import { getOrderItemsByOrderIds, getOrders } from "@/lib/supabase/queries";

export default async function OrdersPage() {
  const identity = await guardPage(["admin", "manager", "staff"]);
  const orders = await getOrders();
  const orderItems = await getOrderItemsByOrderIds(orders.map((order) => order.id));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-slate-900">Orders</h2>
      <Card>
        <CardHeader>
          <CardTitle>Order workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusManager orders={orders} canUpdateStatus />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order detail drawer (expanded rows)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orders.map((order) => {
              const items = orderItems.filter((item) => item.order_id === order.id);
              return (
                <details key={order.id} className="rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    {order.id} - {order.customer_name} ({order.order_status})
                  </summary>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    {items.length === 0 ? (
                      <p>No items found.</p>
                    ) : (
                      items.map((item) => (
                        <p key={item.id}>
                          Product {item.product_id} | Variant {item.variant_id ?? "N/A"} | Qty{" "}
                          {item.quantity} | Price {item.price_at_time}
                        </p>
                      ))
                    )}
                  </div>
                </details>
              );
            })}
          </div>
          {identity.profile.role === "staff" ? (
            <p className="mt-4 text-xs text-slate-500">
              Staff can update order status only; pricing and payment changes are blocked.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

