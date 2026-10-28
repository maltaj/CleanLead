import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { SimpleActionForm } from "@/components/templates/simple-action-form";
import { TemplateForm } from "@/components/templates/template-form";
import { requireOrganisation } from "@/lib/auth/dal";
import { listTemplates } from "@/lib/follow-ups/queries";
import { TEMPLATE_FIELDS } from "@/lib/templates/render";
import { addStarterTemplates, createTemplate, deleteTemplate, updateTemplate } from "./actions";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage({ params }: PageProps<"/app/[orgSlug]/templates">) {
  const { orgSlug } = await params;
  const org = await requireOrganisation(orgSlug);
  const templates = await listTemplates(org.id);
  const canDelete = org.role === "owner" || org.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Message templates</h1>
        <p className="text-muted text-sm">
          Reusable messages for quote follow-ups. Open a lead to fill one in, copy it, or send it on
          WhatsApp.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {templates.length === 0 ? (
            <Card className="space-y-3">
              <p className="font-medium">No templates yet.</p>
              <p className="text-muted text-sm">
                Start with three ready-made messages and edit them to sound like you.
              </p>
              <SimpleActionForm
                action={addStarterTemplates.bind(null, org.slug)}
                label="Add starter templates"
                pendingText="Adding…"
                variant="primary"
              />
            </Card>
          ) : (
            <ul className="space-y-3">
              {templates.map((t) => (
                <li key={t.id}>
                  <details className="border-border bg-card rounded-xl border">
                    <summary className="cursor-pointer px-4 py-3 font-medium">{t.name}</summary>
                    <div className="border-border space-y-4 border-t p-4">
                      <TemplateForm
                        idPrefix={`edit-${t.id}`}
                        action={updateTemplate.bind(null, org.slug, t.id)}
                        defaults={{ name: t.name, body: t.body }}
                        submitLabel="Save changes"
                      />
                      {canDelete ? (
                        <SimpleActionForm
                          action={deleteTemplate.bind(null, org.slug, t.id)}
                          label="Delete template"
                          pendingText="Deleting…"
                          variant="ghost"
                        />
                      ) : null}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">New template</h2>
            <TemplateForm
              idPrefix="new"
              action={createTemplate.bind(null, org.slug)}
              submitLabel="Add template"
            />
          </Card>
        </div>

        <Card className="h-fit space-y-2">
          <h2 className="text-lg font-semibold">Fill-in fields</h2>
          <p className="text-muted text-sm">
            Type these in a message and they are replaced from the lead:
          </p>
          <ul className="space-y-1 text-sm">
            {TEMPLATE_FIELDS.map((f) => (
              <li key={f.key}>
                <code className="bg-brand-soft rounded px-1.5 py-0.5 text-xs">{`{{${f.key}}}`}</code>{" "}
                <span className="text-muted">{f.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
