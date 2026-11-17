import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { TaxiyaDatabase } from "@/types/taxiya";
import { SUPABASE_ANON_KEY, SUPABASE_URL, TAXIYA_SCHEMA } from "./config";

function applyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}

export async function updateSessionAndVerifyAdmin(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<TaxiyaDatabase, "taxiya">(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      db: { schema: TAXIYA_SCHEMA },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname.startsWith("/login");

  if (!user) {
    if (isLoginRoute) return supabaseResponse;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.delete("motivo");
    const redirectResponse = NextResponse.redirect(loginUrl);
    applyResponseCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, account_status")
    .eq("id", user.id)
    .maybeSingle();

  const isAuthorizedAdmin =
    !profileError &&
    profile !== null &&
    profile.role === "admin" &&
    profile.account_status === "active";

  if (!isAuthorizedAdmin) {
    await supabase.auth.signOut();
    if (isLoginRoute) {
      return supabaseResponse;
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("motivo", "sin_permisos");
    const redirectResponse = NextResponse.redirect(loginUrl);
    applyResponseCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  if (isLoginRoute) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    const redirectResponse = NextResponse.redirect(homeUrl);
    applyResponseCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  return supabaseResponse;
}
