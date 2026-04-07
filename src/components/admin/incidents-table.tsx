"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import type { OpsIncident, OpsIncidentStatus } from "@/lib/types/domain";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-UG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function severityClasses(severity: string) {
  if (severity === "critical") return "bg-red-100 text-red-700";
  if (severity === "high") return "bg-amber-100 text-amber-700";
  if (severity === "medium") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function statusClasses(status: string) {
  if (status === "open") return "bg-red-100 text-red-700";
  if (status === "resolved") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export function IncidentsTable({ incidents }: { incidents: OpsIncident[] }) {
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  async function updateIncidentStatus(incidentId: string, status: OpsIncidentStatus) {
    setActiveIncidentId(incidentId);

    try {
      const response = await fetch(`/api/admin/incidents/${incidentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "Failed to update incident status");
      }

      toast({ title: `Incident marked ${formatLabel(status).toLowerCase()}.` });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to update incident status.",
      });
    } finally {
      setActiveIncidentId(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Seen</TableHead>
            <TableHead>Count</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((incident) => {
            const loading = activeIncidentId === incident.id;

            return (
              <TableRow key={incident.id}>
                <TableCell className="font-medium text-slate-900">
                  {formatLabel(incident.incident_type)}
                </TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityClasses(incident.severity)}`}>
                    {formatLabel(incident.severity)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(incident.status)}`}>
                    {formatLabel(incident.status)}
                  </span>
                </TableCell>
                <TableCell>
                  {incident.order_id ? (
                    <Link href={`/orders/${incident.order_id}`} className="text-kira-red hover:underline">
                      {incident.order_id.slice(0, 8).toUpperCase()}
                    </Link>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-xs text-slate-500">
                    <div>Last: {formatTimestamp(incident.last_seen_at)}</div>
                    <div>First: {formatTimestamp(incident.first_seen_at)}</div>
                  </div>
                </TableCell>
                <TableCell>{incident.occurrence_count}</TableCell>
                <TableCell className="max-w-[360px]">
                  <div className="space-y-1">
                    <div>{incident.message}</div>
                    <div className="text-xs text-slate-500">{incident.source}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {incident.status !== "resolved" ? (
                      <Button
                        size="sm"
                        loading={loading}
                        onClick={() => updateIncidentStatus(incident.id, "resolved")}
                      >
                        Resolve
                      </Button>
                    ) : null}
                    {incident.status !== "ignored" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={loading}
                        onClick={() => updateIncidentStatus(incident.id, "ignored")}
                      >
                        Ignore
                      </Button>
                    ) : null}
                    {incident.status !== "open" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={loading}
                        onClick={() => updateIncidentStatus(incident.id, "open")}
                      >
                        Reopen
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
