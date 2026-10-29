import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { ToggleForm } from "@/components/public-enquiry/toggle-form";
import { requireOrganisation } from "@/lib/auth/dal";
import { getEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { setPublicForm } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/app/[orgSlug]/settings">) {
  const { orgSlug } = await params;
  const org = await requireOrganisation(orgSlug);
  const supabase = await createClient();
  const { data } = await supabase
    .from("organisations")
    .select("public_form_enabled")
    .eq("id", org.id)
    .single();
  const enabled = data?.public_form_enabled === true;
  const canEdit = org.role !== "member";
  const url = `${getEnv().NEXT_PUBLIC_SITE_URL}/enquire/${org.slug}`;
  const embed = `<iframe src="${url}" title="Request a quote" width="100%" height="900" style="border:0"></iframe>`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold">Public enquiry form</h2>
          <p className="text-muted text-sm">
            Share the link or add the form to your website. Every enquiry lands in Leads as a New
            lead from &quot;Website form&quot;.
          </p>
        </div>
        <p className="text-sm">
          Status:{" "}
          <span className="bg-brand-soft rounded-full px-2 py-0.5 text-xs">
            {enabled ? "Live" : "Off"}
          </span>
        </p>
        {enabled ? (
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Link</p>
              <input
                readOnly
                value={url}
                aria-label="Enquiry form link"
                className="border-border bg-card w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <p className="font-medium">Embed on your website</p>
              <textarea
                readOnly
                value={embed}
                aria-label="Embed code"
                rows={3}
                className="border-border bg-card w-full rounded-lg border px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>
        ) : null}
        {canEdit ? (
          <ToggleForm action={setPublicForm.bind(null, org.slug, !enabled)} enabled={enabled} />
        ) : (
          <p className="text-muted text-sm">Only owners and admins can change this.</p>
        )}
      </Card>
    </div>
  );
}
