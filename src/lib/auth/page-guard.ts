import { redirect } from "next/navigation";
import { AppError } from "@/lib/http/errors";
import { requireRole } from "@/lib/auth/authorize";
import type { AllowedRole } from "@/lib/auth/roles";

export async function guardPage(
  allowedRoles: readonly AllowedRole[],
): Promise<Awaited<ReturnType<typeof requireRole>>> {
  try {
    return await requireRole(allowedRoles);
  } catch (error) {
    if (error instanceof AppError) {
      if (error.status === 401) {
        redirect("/login");
      }
      if (error.status === 403) {
        redirect("/forbidden");
      }
    }
    redirect("/login");
  }
}

