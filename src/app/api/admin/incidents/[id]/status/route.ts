import { writeAdminAuditLog } from "@/lib/audit/admin-audit";
import { notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { incidentStatusPatchSchema } from "@/lib/schemas/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const PATCH = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin"],
    actionName: "patch_incident_status",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (request, { identity, ip, params }) => {
    const input = await parseJsonBody(request, incidentStatusPatchSchema);
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("ops_incidents")
      .update({
        status: input.status,
        resolved_at: input.status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", params.id)
      .select("id,status,resolved_at")
      .maybeSingle();

    if (error) {
      throw new Error(`Incident status update failed: ${error.message}`);
    }

    if (!data) {
      throw notFound("Operational incident not found");
    }

    await writeAdminAuditLog({
      actorUserId: identity.user.id,
      actorRole: identity.profile.role,
      requestIp: ip,
      action: "incident_status_update",
      entityType: "ops_incident",
      entityId: params.id,
      outcome: "succeeded",
      details: {
        nextStatus: input.status,
      },
    });

    return jsonOk({
      incident: data,
    });
  },
);
