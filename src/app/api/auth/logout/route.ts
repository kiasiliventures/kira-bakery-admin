import { NextResponse } from "next/server";
import { jsonError, mapUnknownError } from "@/lib/http/responses";
import { assertSameOriginMutation } from "@/lib/http/route-helpers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(mapUnknownError(error, "logout"));
  }
}
