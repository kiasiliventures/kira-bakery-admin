"use client";

import { createBrowserClient } from "@supabase/ssr";
import { assertPublicEnv, publicEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  assertPublicEnv();
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}

