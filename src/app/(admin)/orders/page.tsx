import { PageShell } from "@/components/admin/page-shell";
import { OrderStatusManager } from "@/components/admin/order-status-manager";
import { guardPage } from "@/lib/auth/page-guard";
import { getOrders } from "@/lib/supabase/queries";

export default async function OrdersPage() {
  const identity = await guardPage(["admin", "manager", "staff"]);
  const orders = await getOrders();
  const canUpdateStatus =
    identity.profile.role === "admin" ||
    identity.profile.role === "manager" ||
    identity.profile.role === "staff";

  return (
    <PageShell title="Orders">
      <OrderStatusManager orders={orders} canUpdateStatus={canUpdateStatus} />
    </PageShell>
  );
}
