import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MyOrganisation, OrgRole, TeamMember } from "@/lib/types";

/** Verified user (asks the Auth server, never trusts the cookie alone). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** Organisations the current user belongs to. Tenancy comes from the memberships table via RLS. */
export const listMyOrganisations = cache(async (): Promise<MyOrganisation[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organisations!inner(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load organisations (${error.code})`);

  const rows = (data ?? []) as unknown as {
    role: OrgRole;
    organisations: { id: string; name: string; slug: string };
  }[];
  return rows.map((row) => ({ ...row.organisations, role: row.role }));
});

/**
 * Resolves an organisation from the URL slug. The slug is only a lookup key: RLS decides
 * whether this user may see the row, so a non-member gets the same 404 as a missing org.
 */
export const requireOrganisation = cache(async (slug: string): Promise<MyOrganisation> => {
  const orgs = await listMyOrganisations();
  const match = orgs.find((org) => org.slug === slug);
  if (!match) notFound();
  return match;
});

export async function listTeam(orgId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, role, profiles(full_name, email)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load team (${error.code})`);
  return (data ?? []) as unknown as TeamMember[];
}
