import type { User } from "@supabase/supabase-js";
import { forbidden, unauthorized } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { hasRequiredRole, type AllowedRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/domain";

export type RequestIdentity = {
  user: User;
  profile: Pick<Profile, "id" | "email" | "role">;
};

export async function getIdentity(): Promise<RequestIdentity> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw unauthorized();
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    logger.warn("profile_missing_or_failed", {
      userId: userData.user.id,
      profileError: profileError?.message,
    });
    throw forbidden("Profile not found or access denied");
  }

  return {
    user: userData.user,
    profile: profile as RequestIdentity["profile"],
  };
}

export async function requireRole(
  allowedRoles: readonly AllowedRole[],
): Promise<RequestIdentity> {
  const identity = await getIdentity();
  if (!hasRequiredRole(identity.profile.role, allowedRoles)) {
    throw forbidden("You are not authorized to perform this action");
  }
  return identity;
}

