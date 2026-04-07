import { notFound } from "next/navigation";
import { OrderStatusManager } from "@/components/admin/order-status-manager";
import { PageShell } from "@/components/admin/page-shell";
import { guardPage } from "@/lib/auth/page-guard";
import { formatOrderReference } from "@/lib/orders";
import { getOrderById } from "@/lib/supabase/queries";

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await guardPage(["admin", "manager", "staff"]);
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  const canUpdateStatus =
    identity.profile.role === "admin"
    || identity.profile.role === "manager"
    || identity.profile.role === "staff";

  return (
    <PageShell title={formatOrderReference(order.id)}>
      <OrderStatusManager orders={[order]} canUpdateStatus={canUpdateStatus} />
    </PageShell>
  );
}
