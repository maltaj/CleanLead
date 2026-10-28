import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/leads/lead-form";
import { StageBadge } from "@/components/leads/stage-badge";
import { StageForm } from "@/components/leads/stage-form";
import { Card } from "@/components/ui/card";
import { AddFollowUpForm } from "@/components/follow-ups/add-follow-up-form";
import { FollowUpItem } from "@/components/follow-ups/follow-up-item";
import { TemplatePicker } from "@/components/templates/template-picker";
import { getUser, listTeam, requireOrganisation } from "@/lib/auth/dal";
import { listFollowUpsForLead, listTemplates } from "@/lib/follow-ups/queries";
import { todaySastDate } from "@/lib/follow-ups/time";
import { formatDate, formatDateTime } from "@/lib/format";
import { describeEvent } from "@/lib/leads/events";
import { centsToRandsInput, formatZar } from "@/lib/leads/money";
import { getLead, listLeadEvents } from "@/lib/leads/queries";
import { uuidSchema } from "@/lib/validation/leads";
import { createFollowUp } from "../../follow-ups/actions";
import { changeStage, updateLead } from "../actions";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: PageProps<"/app/[orgSlug]/leads/[leadId]">) {
  const { orgSlug, leadId } = await params;
  const org = await requireOrganisation(orgSlug);
  if (!uuidSchema.safeParse(leadId).success) notFound();

  // Scoped to this organisation and to RLS: a UUID from another tenant is simply "not found".
  const lead = await getLead(org.id, leadId);
  if (!lead) notFound();

  const [events, team, followUps, templates, user] = await Promise.all([
    listLeadEvents(org.id, lead.id),
    listTeam(org.id),
    listFollowUpsForLead(org.id, lead.id),
    listTemplates(org.id),
    getUser(),
  ]);
  const now = new Date();
  const today = todaySastDate(now);
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const isClosed = lead.stage === "won" || lead.stage === "lost";
  const openFollowUps = followUps.filter((f) => f.status === "open");
  const closedFollowUps = followUps.filter((f) => f.status !== "open").reverse();
  const names = new Map(
    team.map((m) => [m.user_id, m.profiles?.full_name || m.profiles?.email || "A team member"]),
  );
  const senderName = (user && names.get(user.id)) || "";
  const nameOf = (id: string | null) =>
    id ? (names.get(id) ?? "A former team member") : "The system";

  return (
    <div className="space-y-4">
      <Link href={`/app/${org.slug}/leads`} className="text-brand text-sm hover:underline">
        ← Back to leads
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
        <StageBadge stage={lead.stage} />
      </div>
      <p className="text-muted text-sm">
        Added {formatDate(lead.created_at)}
        {lead.closed_at ? ` · Closed ${formatDate(lead.closed_at)}` : ""}
        {lead.lost_reason ? ` · Reason: ${lead.lost_reason}` : ""}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card className="space-y-5">
            <h2 className="text-lg font-semibold">Details</h2>
            <LeadForm
              action={updateLead.bind(null, org.slug, lead.id)}
              submitLabel="Save changes"
              team={team.map((m) => ({ id: m.user_id, label: names.get(m.user_id) ?? "Member" }))}
              defaults={{
                name: lead.name,
                phone: lead.phone ?? "",
                email: lead.email ?? "",
                suburb: lead.suburb ?? "",
                serviceType: lead.service_type,
                estValue: centsToRandsInput(lead.est_value_cents),
                source: lead.source,
                assignedTo: lead.assigned_to ?? "",
                notes: lead.notes ?? "",
              }}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">Stage</h2>
            <StageForm action={changeStage.bind(null, org.slug, lead.id)} current={lead.stage} />
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">Follow-ups</h2>
            {openFollowUps.length > 0 ? (
              <ul className="space-y-3">
                {openFollowUps.map((f) => (
                  <FollowUpItem
                    key={f.id}
                    followUp={f}
                    orgSlug={org.slug}
                    now={now}
                    nameOf={nameOf}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">No open follow-ups.</p>
            )}
            {isClosed ? (
              <p className="text-muted text-sm">
                This lead is closed. Reopen it to schedule a follow-up.
              </p>
            ) : (
              <AddFollowUpForm
                action={createFollowUp.bind(null, org.slug, lead.id)}
                team={team.map((m) => ({ id: m.user_id, label: names.get(m.user_id) ?? "Member" }))}
                minDate={today}
                defaultDate={tomorrow.toISOString().slice(0, 10)}
              />
            )}
            {closedFollowUps.length > 0 ? (
              <details>
                <summary className="text-muted cursor-pointer text-sm">
                  History ({closedFollowUps.length})
                </summary>
                <ul className="mt-2 space-y-2">
                  {closedFollowUps.map((f) => (
                    <li key={f.id} className="text-sm">
                      <p>
                        {f.status === "done" ? "Completed" : "Skipped"}
                        {f.completed_at ? ` · ${formatDate(f.completed_at)}` : ""}
                      </p>
                      {f.outcome ? <p className="text-muted text-xs">{f.outcome}</p> : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">Message</h2>
            <TemplatePicker
              templates={templates}
              phone={lead.phone}
              manageHref={`/app/${org.slug}/templates`}
              vars={{
                customer_name: lead.name.trim().split(/\s+/)[0],
                business_name: org.name,
                service: lead.service_type,
                suburb: lead.suburb,
                quote_value: lead.est_value_cents === null ? "" : formatZar(lead.est_value_cents),
                sender_name: senderName,
              }}
            />
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">Activity</h2>
            <ol className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="text-sm">
                  <p>{describeEvent(event, nameOf)}</p>
                  <p className="text-muted text-xs">{formatDateTime(event.created_at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
