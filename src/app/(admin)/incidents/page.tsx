import { IncidentsTable } from "@/components/admin/incidents-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/admin/page-shell";
import { guardPage } from "@/lib/auth/page-guard";
import { getOperationalIncidents } from "@/lib/supabase/queries";

export default async function IncidentsPage() {
  await guardPage(["admin"]);
  const incidents = await getOperationalIncidents({ limit: 100 });

  return (
    <PageShell title="Operational Incidents">
      <Card>
        <CardHeader>
          <CardTitle>Incident Log</CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-kira-border p-6 text-sm text-slate-500">
              No operational incidents recorded yet.
            </div>
          ) : (
            <IncidentsTable incidents={incidents} />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
