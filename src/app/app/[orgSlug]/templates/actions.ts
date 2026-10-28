"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation, requireUser } from "@/lib/auth/dal";
import { fieldErrors, formString, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { STARTER_TEMPLATES } from "@/lib/templates/render";
import { templateSchema } from "@/lib/validation/follow-ups";
import { uuidSchema } from "@/lib/validation/leads";

const GENERIC_ERROR = "We couldn't save that. Please try again.";

function refresh(orgSlug: string) {
  revalidatePath(`/app/${orgSlug}`, "layout");
}

export async function createTemplate(
  orgSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const org = await requireOrganisation(orgSlug);

  const raw = { name: formString(formData, "name"), body: formString(formData, "body") };
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  const { error } = await supabase
    .from("templates")
    .insert({ org_id: org.id, name: parsed.data.name, body: parsed.data.body });
  if (error) {
    console.error("createTemplate failed", { code: error.code });
    return { status: "error", message: GENERIC_ERROR, values: raw };
  }

  refresh(org.slug);
  return { status: "success", message: "Template added." };
}

export async function updateTemplate(
  orgSlug: string,
  templateId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const org = await requireOrganisation(orgSlug);
  if (!uuidSchema.safeParse(templateId).success) return { status: "error", message: GENERIC_ERROR };

  const raw = { name: formString(formData, "name"), body: formString(formData, "body") };
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .update({ name: parsed.data.name, body: parsed.data.body })
    .eq("id", templateId)
    .eq("org_id", org.id)
    .select("id");
  if (error) {
    console.error("updateTemplate failed", { code: error.code });
    return { status: "error", message: GENERIC_ERROR, values: raw };
  }
  if (!data || data.length === 0) {
    return { status: "error", message: "That template no longer exists.", values: raw };
  }

  refresh(org.slug);
  return { status: "success", message: "Template saved.", values: raw };
}

export async function deleteTemplate(
  orgSlug: string,
  templateId: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  await requireUser();
  const org = await requireOrganisation(orgSlug);
  if (!uuidSchema.safeParse(templateId).success) return { status: "error", message: GENERIC_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .delete()
    .eq("id", templateId)
    .eq("org_id", org.id)
    .select("id");
  if (error) {
    console.error("deleteTemplate failed", { code: error.code });
    return { status: "error", message: GENERIC_ERROR };
  }
  if (!data || data.length === 0) {
    return { status: "error", message: "Only owners and admins can delete templates." };
  }

  refresh(org.slug);
  return { status: "success", message: "Template deleted." };
}

export async function addStarterTemplates(
  orgSlug: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  await requireUser();
  const org = await requireOrganisation(orgSlug);

  const supabase = await createClient();
  const { error } = await supabase
    .from("templates")
    .insert(STARTER_TEMPLATES.map((t) => ({ org_id: org.id, name: t.name, body: t.body })));
  if (error) {
    console.error("addStarterTemplates failed", { code: error.code });
    return { status: "error", message: GENERIC_ERROR };
  }

  refresh(org.slug);
  return { status: "success", message: "Starter templates added." };
}
