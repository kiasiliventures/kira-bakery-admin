import { InventoryTable } from "@/components/admin/inventory-table";
import { PageShell } from "@/components/admin/page-shell";
import { guardPage } from "@/lib/auth/page-guard";
import { getProducts } from "@/lib/supabase/queries";

export default async function InventoryPage() {
  const identity = await guardPage(["admin", "manager", "staff"]);
  const products = await getProducts();
  const canManage = identity.profile.role === "admin" || identity.profile.role === "manager";

  return (
    <PageShell title="Inventory & Stock Management">
      <InventoryTable products={products} canManage={canManage} />
    </PageShell>
  );
}
