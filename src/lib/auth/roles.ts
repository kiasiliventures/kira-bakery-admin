import type { AppRole } from "@/lib/types/domain";

export const ROLES = {
  admin: "admin",
  manager: "manager",
  staff: "staff",
} as const satisfies Record<AppRole, AppRole>;

export type AllowedRole = AppRole;

export function hasRequiredRole(
  role: AllowedRole,
  allowedRoles: readonly AllowedRole[],
): boolean {
  return allowedRoles.includes(role);
}

