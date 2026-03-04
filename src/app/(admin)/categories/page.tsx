import { CategoryManager } from "@/components/admin/category-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage } from "@/lib/auth/page-guard";
import { getCategories } from "@/lib/supabase/queries";

export default async function CategoriesPage() {
  const identity = await guardPage(["admin", "manager", "staff"]);
  const categories = await getCategories();
  const canManage = identity.profile.role === "admin" || identity.profile.role === "manager";

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-slate-900">Categories</h2>
      <Card>
        <CardHeader>
          <CardTitle>Category management</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryManager categories={categories} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}

