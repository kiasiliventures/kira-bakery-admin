import { CakePricingManager } from "@/components/admin/cake-pricing-manager";
import { PageShell } from "@/components/admin/page-shell";
import { guardPage } from "@/lib/auth/page-guard";
import { getCakeAdminData } from "@/lib/cakes/data";

export default async function CakesPage() {
  const identity = await guardPage(["admin", "manager", "staff"]);
  const cakeData = await getCakeAdminData();
  const canManage = identity.profile.role === "admin" || identity.profile.role === "manager";

  return (
    <PageShell title="Cake Pricing">
      <CakePricingManager {...cakeData} canManage={canManage} />
    </PageShell>
  );
}
