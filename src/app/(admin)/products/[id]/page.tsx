import { notFound } from "next/navigation";
import { PageShell } from "@/components/admin/page-shell";
import { ProductDetailManager } from "@/components/admin/product-detail-manager";
import { guardPage } from "@/lib/auth/page-guard";
import { getCategories, getProductById } from "@/lib/supabase/queries";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const identity = await guardPage(["admin", "manager", "staff"]);
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();
  const categories = await getCategories();
  const canManage = identity.profile.role === "admin" || identity.profile.role === "manager";

  return (
    <PageShell title="Edit Product">
      <ProductDetailManager
        product={product}
        categories={categories}
        canManage={canManage}
      />
    </PageShell>
  );
}
