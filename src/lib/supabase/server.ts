import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { assertPublicEnv, publicEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  assertPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore when called in contexts where cookie mutation is unavailable.
        }
      },
    },
  });
}

