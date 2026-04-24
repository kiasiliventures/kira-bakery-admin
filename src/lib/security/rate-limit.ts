import { tooManyRequests } from "@/lib/http/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export function getAdminPreAuthRateLimit(method: string) {
  const normalizedMethod = method.trim().toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS") {
    return { limit: 180, windowMs: 60_000 };
  }

  return { limit: 60, windowMs: 60_000 };
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<void> {
  const { key, limit, windowMs } = options;
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.rpc("consume_admin_rate_limit", {
    rate_key: key,
    max_requests: limit,
    window_seconds: Math.ceil(windowMs / 1000),
  });

  if (error) {
    throw new Error(`Rate limit check failed: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) {
    throw tooManyRequests("Rate limit exceeded", result?.retry_after_seconds);
  }
}
