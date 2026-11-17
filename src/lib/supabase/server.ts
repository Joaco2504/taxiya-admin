import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { TaxiyaDatabase } from "@/types/taxiya";
import { SUPABASE_ANON_KEY, SUPABASE_URL, TAXIYA_SCHEMA } from "./config";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<TaxiyaDatabase, "taxiya">(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: TAXIYA_SCHEMA },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignorado cuando se invoca desde un Server Component de solo lectura.
        }
      },
    },
  });
}
