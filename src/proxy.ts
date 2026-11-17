import type { NextRequest } from "next/server";
import { updateSessionAndVerifyAdmin } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSessionAndVerifyAdmin(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
