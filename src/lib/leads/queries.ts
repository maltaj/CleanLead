import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Lead, LeadEvent, LeadListItem } from "@/lib/types";
import { LEAD_STAGES, PAGE_SIZE, type LeadStage } from "./constants";
import { sanitizeSearchTerm } from "./search";

const LIST_COLUMNS =
  "id, name, phone, email, suburb, service_type, est_value_cents, source, stage, assigned_to, created_at";

export async function listLeads(
  orgId: string,
  opts: { q?: string; stage?: LeadStage; page?: number },
): Promise<{ leads: LeadListItem[]; total: number; page: number }> {
  const supabase = await createClient();
  const page = Math.max(1, Math.min(opts.page ?? 1, 1000));
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("leads")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (opts.stage) query = query.eq("stage", opts.stage);

  const term = sanitizeSearchTerm(opts.q);
  if (term) {
    const pattern = `%${term}%`;
    query = query.or(
      ["name", "phone", "email", "suburb"].map((column) => `${column}.ilike.${pattern}`).join(","),
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Could not load leads (${error.code})`);
  return { leads: (data ?? []) as LeadListItem[], total: count ?? 0, page };
}

export async function getLead(orgId: string, leadId: string): Promise<Lead | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(`${LIST_COLUMNS}, org_id, notes, lost_reason, closed_at, updated_at`)
    .eq("org_id", orgId)
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(`Could not load lead (${error.code})`);
  return (data as Lead | null) ?? null;
}

export async function listLeadEvents(orgId: string, leadId: string): Promise<LeadEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_events")
    .select("id, actor_id, type, from_stage, to_stage, meta, created_at")
    .eq("org_id", orgId)
    .eq("lead_id", leadId)
    .order("id", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load activity (${error.code})`);
  return (data ?? []) as LeadEvent[];
}

export async function countLeadsByStage(orgId: string): Promise<Record<LeadStage, number>> {
  const supabase = await createClient();
  const entries = await Promise.all(
    LEAD_STAGES.map(async (stage) => {
      const { count, error } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("stage", stage);
      if (error) throw new Error(`Could not count leads (${error.code})`);
      return [stage, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<LeadStage, number>;
}
