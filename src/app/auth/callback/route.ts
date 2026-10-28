import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { getEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Completes email-link flows (signup confirmation, password reset) by exchanging the PKCE code. */
export async function GET(request: NextRequest) {
  const site = getEnv().NEXT_PUBLIC_SITE_URL;
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, site));
  }

  return NextResponse.redirect(new URL("/login?error=link", site));
}
