import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FollowUp, FollowUpWithLead, Template } from "@/lib/types";
import { classifyDue, type DueBucket } from "./time";

const FU_COLUMNS =
  "id, lead_id, due_at, status, note, outcome, assigned_to, created_at, completed_at";

export async function listFollowUpsForLead(orgId: string, leadId: string): Promise<FollowUp[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select(FU_COLUMNS)
    .eq("org_id", orgId)
    .eq("lead_id", leadId)
    .order("due_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`Could not load follow-ups (${error.code})`);
  return (data ?? []) as FollowUp[];
}

export type OpenFollowUps = Record<DueBucket, FollowUpWithLead[]>;

/** Open follow-ups for the organisation, grouped into overdue / today / upcoming. */
export async function listOpenFollowUps(
  orgId: string,
  opts: { assignedTo?: string; now?: Date } = {},
): Promise<OpenFollowUps> {
  const supabase = await createClient();
  let query = supabase
    .from("follow_ups")
    .select(`${FU_COLUMNS}, leads(name, phone, stage)`)
    .eq("org_id", orgId)
    .eq("status", "open")
    .order("due_at", { ascending: true })
    .limit(300);
  if (opts.assignedTo) query = query.eq("assigned_to", opts.assignedTo);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load follow-ups (${error.code})`);

  const now = opts.now ?? new Date();
  const grouped: OpenFollowUps = { overdue: [], today: [], upcoming: [] };
  for (const row of (data ?? []) as unknown as FollowUpWithLead[]) {
    grouped[classifyDue(row.due_at, now)].push(row);
  }
  return grouped;
}

export async function listRecentlyClosedFollowUps(
  orgId: string,
  limit = 15,
): Promise<FollowUpWithLead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select(`${FU_COLUMNS}, leads(name, phone, stage)`)
    .eq("org_id", orgId)
    .neq("status", "open")
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load follow-ups (${error.code})`);
  return (data ?? []) as unknown as FollowUpWithLead[];
}

export async function listTemplates(orgId: string): Promise<Template[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, body")
    .eq("org_id", orgId)
    .order("name", { ascending: true })
    .limit(100);
  if (error) throw new Error(`Could not load templates (${error.code})`);
  return (data ?? []) as Template[];
}
