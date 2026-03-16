"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertPublicEnv, publicEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient() {
  assertPublicEnv();

  if (typeof window === "undefined") {
    return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }

  if (!browserClient) {
    browserClient = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }

  return browserClient;
}
