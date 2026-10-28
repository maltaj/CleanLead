"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation, requireUser } from "@/lib/auth/dal";
import { fieldErrors, formString, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import {
  completeFollowUpSchema,
  createFollowUpSchema,
  skipFollowUpSchema,
} from "@/lib/validation/follow-ups";
import { uuidSchema } from "@/lib/validation/leads";

const GENERIC_ERROR = "We couldn't save that. Please try again.";

function refresh(orgSlug: string) {
  revalidatePath(`/app/${orgSlug}`, "layout");
}

// As with leads, the organisation comes from the URL slug checked against the caller's own
// memberships. RLS and the database triggers re-check tenancy and the follow-up rules.

export async function createFollowUp(
  orgSlug: string,
  leadId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const org = await requireOrganisation(orgSlug);
  if (!uuidSchema.safeParse(leadId).success) return { status: "error", message: GENERIC_ERROR };

  const raw = {
    dueDate: formString(formData, "dueDate"),
    dueTime: formString(formData, "dueTime"),
    note: formString(formData, "note"),
    assignedTo: formString(formData, "assignedTo"),
  };
  const parsed = createFollowUpSchema.safeParse(raw);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  const { error } = await supabase.from("follow_ups").insert({
    org_id: org.id,
    lead_id: leadId,
    due_at: parsed.data.dueAt,
    note: parsed.data.note,
    assigned_to: parsed.data.assignedTo,
  });

  if (error) {
    console.error("createFollowUp failed", { code: error.code });
    if (error.code === "23514") {
      return {
        status: "error",
        message: "This lead is closed. Reopen it to schedule a follow-up.",
        values: raw,
      };
    }
    return { status: "error", message: GENERIC_ERROR, values: raw };
  }

  refresh(org.slug);
  return { status: "success", message: "Follow-up scheduled." };
}

export async function completeFollowUp(
  orgSlug: string,
  followUpId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const org = await requireOrganisation(orgSlug);
  if (!uuidSchema.safeParse(followUpId).success) return { status: "error", message: GENERIC_ERROR };

  const raw = {
    outcome: formString(formData, "outcome"),
    nextDate: formString(formData, "nextDate"),
    nextTime: formString(formData, "nextTime"),
    nextNote: formString(formData, "nextNote"),
  };
  const parsed = completeFollowUpSchema.safeParse(raw);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };

  // Confirm the follow-up belongs to this organisation before calling the database function.
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("follow_ups")
    .select("id")
    .eq("id", followUpId)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!existing)
    return { status: "error", message: "That follow-up no longer exists.", values: raw };

  const { error } = await supabase.rpc("complete_follow_up", {
    p_follow_up_id: followUpId,
    p_outcome: parsed.data.outcome,
    p_next_due_at: parsed.data.nextDueAt ?? undefined,
    p_next_note: parsed.data.nextNote ?? undefined,
  });

  if (error) {
    console.error("completeFollowUp failed", { code: error.code });
    if (error.code === "P0002") {
      return { status: "error", message: "That follow-up was already completed.", values: raw };
    }
    return { status: "error", message: GENERIC_ERROR, values: raw };
  }

  refresh(org.slug);
  return {
    status: "success",
    message: parsed.data.nextDueAt
      ? "Completed. Next follow-up scheduled."
      : "Follow-up completed.",
  };
}

export async function skipFollowUp(
  orgSlug: string,
  followUpId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const org = await requireOrganisation(orgSlug);
  if (!uuidSchema.safeParse(followUpId).success) return { status: "error", message: GENERIC_ERROR };

  const parsed = skipFollowUpSchema.safeParse({ reason: formString(formData, "reason") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .update({ status: "skipped", outcome: parsed.data.reason ?? "Skipped" })
    .eq("id", followUpId)
    .eq("org_id", org.id)
    .eq("status", "open")
    .select("id");

  if (error) {
    console.error("skipFollowUp failed", { code: error.code });
    return { status: "error", message: GENERIC_ERROR };
  }
  if (!data || data.length === 0)
    return { status: "error", message: "That follow-up was already closed." };

  refresh(org.slug);
  return { status: "success", message: "Follow-up skipped." };
}
