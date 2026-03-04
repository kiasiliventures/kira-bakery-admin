import { ProductManager } from "@/components/admin/product-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage } from "@/lib/auth/page-guard";
import { getCategories, getProducts } from "@/lib/supabase/queries";

export default async function ProductsPage() {
  const identity = await guardPage(["admin", "manager", "staff"]);
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const canManage = identity.profile.role === "admin" || identity.profile.role === "manager";

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-slate-900">Products</h2>
      <Card>
        <CardHeader>
          <CardTitle>Catalog management</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductManager products={products} categories={categories} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}

