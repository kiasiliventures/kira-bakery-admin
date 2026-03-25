import "server-only";

import type { AppRole } from "@/lib/types/domain";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminAuditOutcome = "succeeded" | "failed" | "rejected" | "pending" | "noop";

type WriteAdminAuditLogInput = {
  actorUserId: string;
  actorRole: AppRole;
  requestIp?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  outcome: AdminAuditOutcome;
  details?: Record<string, unknown>;
};

export async function writeAdminAuditLog(input: WriteAdminAuditLogInput): Promise<void> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    request_ip: input.requestIp?.trim() || null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    outcome: input.outcome,
    details: input.details ?? {},
  });

  if (error) {
    logger.error("admin_audit_log_write_failed", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actorUserId,
      outcome: input.outcome,
      error: error.message,
    });
  }
}
