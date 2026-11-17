import React from "react";
import { requireAdminSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LocalityProvider } from "@/components/providers/locality-provider";
import { EmergencyProvider } from "@/components/providers/emergency-provider";
import { AdminShell } from "@/components/shell/admin-shell";
import type { Locality, TaxiCompany } from "@/types/taxiya";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminSession();
  const supabase = await createClient();

  const [locRes, compRes] = await Promise.all([
    supabase.from("localities").select("*").order("name", { ascending: true }),
    supabase.from("taxi_companies").select("*").order("name", { ascending: true }),
  ]);

  const localities = (locRes.data ?? []) as Locality[];
  const companies = (compRes.data ?? []) as TaxiCompany[];

  return (
    <LocalityProvider initialLocalities={localities} initialCompanies={companies}>
      <EmergencyProvider>
        <AdminShell admin={admin}>{children}</AdminShell>
      </EmergencyProvider>
    </LocalityProvider>
  );
}
