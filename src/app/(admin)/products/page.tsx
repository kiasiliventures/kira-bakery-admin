import { PageShell } from "@/components/admin/page-shell";
import { ProductManager } from "@/components/admin/product-manager";
import { guardPage } from "@/lib/auth/page-guard";
import { getCategories, getProducts } from "@/lib/supabase/queries";

export default async function ProductsPage() {
  const identity = await guardPage(["admin", "manager", "staff"]);
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const canManage = identity.profile.role === "admin" || identity.profile.role === "manager";

  return (
    <PageShell title="Manage Products">
      <ProductManager products={products} categories={categories} canManage={canManage} />
    </PageShell>
  );
}
