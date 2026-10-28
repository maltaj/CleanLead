"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation, requireUser } from "@/lib/auth/dal";
import { fieldErrors, formString, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { leadSchema, stageChangeSchema, uuidSchema } from "@/lib/validation/leads";

const GENERIC_ERROR = "We couldn't save that. Please try again.";

function readLeadForm(formData: FormData) {
  const raw = {
    name: formString(formData, "name"),
    phone: formString(formData, "phone"),
    email: formString(formData, "email"),
    suburb: formString(formData, "suburb"),
    serviceType: formString(formData, "serviceType"),
    estValue: formString(formData, "estValue"),
    source: formString(formData, "source"),
    assignedTo: formString(formData, "assignedTo"),
    notes: formString(formData, "notes"),
  };
  return { raw, parsed: leadSchema.safeParse(raw) };
}

function dbErrorMessage(code: string | undefined): string {
  if (code === "23514") return "Check the details: the assignee must be on your team.";
  return GENERIC_ERROR;
}

function revalidateLead(orgSlug: string, leadId: string) {
  revalidatePath(`/app/${orgSlug}/leads/${leadId}`);
  revalidatePath(`/app/${orgSlug}/leads`);
  revalidatePath(`/app/${orgSlug}`);
}

// The organisation is always resolved from the URL slug against the user's own memberships.
// A posted organisation id is never used, and RLS re-checks membership in the database.

export async function createLead(
  orgSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const org = await requireOrganisation(orgSlug);

  const { raw, parsed } = readLeadForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }
  const lead = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      org_id: org.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      suburb: lead.suburb,
      service_type: lead.serviceType,
      est_value_cents: lead.estValue,
      source: lead.source,
      assigned_to: lead.assignedTo,
      notes: lead.notes,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createLead failed", { code: error?.code });
    return { status: "error", message: dbErrorMessage(error?.code), values: raw };
  }

  redirect(`/app/${org.slug}/leads/${data.id}`);
}

export async function updateLead(
  orgSlug: string,
  leadId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const org = await requireOrganisation(orgSlug);
  if (!uuidSchema.safeParse(leadId).success) return { status: "error", message: GENERIC_ERROR };

  const { raw, parsed } = readLeadForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }
  const lead = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      suburb: lead.suburb,
      service_type: lead.serviceType,
      est_value_cents: lead.estValue,
      source: lead.source,
      assigned_to: lead.assignedTo,
      notes: lead.notes,
    })
    .eq("id", leadId)
    .eq("org_id", org.id)
    .select("id");

  if (error) {
    console.error("updateLead failed", { code: error.code });
    return { status: "error", message: dbErrorMessage(error.code), values: raw };
  }
  if (!data || data.length === 0) {
    return { status: "error", message: "That lead no longer exists.", values: raw };
  }
  revalidateLead(org.slug, leadId);
  return { status: "success", message: "Lead updated.", values: raw };
}

export async function changeStage(
  orgSlug: string,
  leadId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const org = await requireOrganisation(orgSlug);
  if (!uuidSchema.safeParse(leadId).success) return { status: "error", message: GENERIC_ERROR };

  const parsed = stageChangeSchema.safeParse({
    stage: formString(formData, "stage"),
    lostReason: formString(formData, "lostReason"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }
  const { stage, lostReason } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ stage, lost_reason: stage === "lost" ? lostReason : null })
    .eq("id", leadId)
    .eq("org_id", org.id)
    .select("id");

  if (error) {
    console.error("changeStage failed", { code: error.code });
    return { status: "error", message: GENERIC_ERROR };
  }
  if (!data || data.length === 0)
    return { status: "error", message: "That lead no longer exists." };
  revalidateLead(org.slug, leadId);
  return { status: "success", message: "Stage updated." };
}
