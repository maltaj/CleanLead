// Hand-written row shapes for the tables used so far. Replace with generated types
// (`npm run db:types`) once the local Supabase stack is running.
export type OrgRole = "member" | "admin" | "owner";

export const ROLE_RANK: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };

export type Organisation = { id: string; name: string; slug: string };

export type MyOrganisation = Organisation & { role: OrgRole };

export type TeamMember = {
  user_id: string;
  role: OrgRole;
  profiles: { full_name: string; email: string } | null;
};
