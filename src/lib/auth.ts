import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/taxiya";

export async function getVerifiedAdmin(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return null;
  if (profile.role !== "admin" || profile.account_status !== "active") {
    return null;
  }

  return profile as Profile;
}

export async function requireAdminSession(): Promise<Profile> {
  const admin = await getVerifiedAdmin();
  if (!admin) {
    redirect("/login?motivo=sin_permisos");
  }
  return admin;
}
