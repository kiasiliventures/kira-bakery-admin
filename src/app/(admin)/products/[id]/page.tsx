import { notFound } from "next/navigation";
import { ProductDetailManager } from "@/components/admin/product-detail-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage } from "@/lib/auth/page-guard";
import { getProductById, getVariantsByProductId } from "@/lib/supabase/queries";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: Props) {
  const identity = await guardPage(["admin", "manager", "staff"]);
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) {
    notFound();
  }

  const variants = await getVariantsByProductId(id);
  const canManage = identity.profile.role === "admin" || identity.profile.role === "manager";

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-slate-900">Product Detail</h2>
      <Card>
        <CardHeader>
          <CardTitle>{product.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductDetailManager product={product} variants={variants} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}

