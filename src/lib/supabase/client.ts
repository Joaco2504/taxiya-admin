"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { TaxiyaDatabase } from "@/types/taxiya";
import { SUPABASE_ANON_KEY, SUPABASE_URL, TAXIYA_SCHEMA } from "./config";

let browserClient: ReturnType<typeof createBrowserClient<TaxiyaDatabase, "taxiya">> | null = null;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<TaxiyaDatabase, "taxiya">(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        db: { schema: TAXIYA_SCHEMA },
      }
    );
  }
  return browserClient;
}
