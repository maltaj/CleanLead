import type { LeadSource, LeadStage } from "@/lib/leads/constants";

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

export type LeadListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  suburb: string | null;
  service_type: string;
  est_value_cents: number | null;
  source: LeadSource;
  stage: LeadStage;
  assigned_to: string | null;
  created_at: string;
};

export type Lead = LeadListItem & {
  org_id: string;
  notes: string | null;
  lost_reason: string | null;
  closed_at: string | null;
  updated_at: string;
};

export type LeadEvent = {
  id: number;
  actor_id: string | null;
  type:
    | "created"
    | "stage_changed"
    | "reopened"
    | "updated"
    | "follow_up_created"
    | "follow_up_done"
    | "follow_up_skipped";
  from_stage: LeadStage | null;
  to_stage: LeadStage | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type FollowUpStatus = "open" | "done" | "skipped";

export type FollowUp = {
  id: string;
  lead_id: string;
  due_at: string;
  status: FollowUpStatus;
  note: string | null;
  outcome: string | null;
  assigned_to: string | null;
  created_at: string;
  completed_at: string | null;
};

export type FollowUpWithLead = FollowUp & {
  leads: { name: string; phone: string | null; stage: LeadStage } | null;
};

export type Template = { id: string; name: string; body: string };
