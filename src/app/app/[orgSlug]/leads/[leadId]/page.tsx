import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/leads/lead-form";
import { StageBadge } from "@/components/leads/stage-badge";
import { StageForm } from "@/components/leads/stage-form";
import { Card } from "@/components/ui/card";
import { listTeam, requireOrganisation } from "@/lib/auth/dal";
import { formatDate, formatDateTime } from "@/lib/format";
import { describeEvent } from "@/lib/leads/events";
import { centsToRandsInput } from "@/lib/leads/money";
import { getLead, listLeadEvents } from "@/lib/leads/queries";
import { uuidSchema } from "@/lib/validation/leads";
import { changeStage, updateLead } from "../actions";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: PageProps<"/app/[orgSlug]/leads/[leadId]">) {
  const { orgSlug, leadId } = await params;
  const org = await requireOrganisation(orgSlug);
  if (!uuidSchema.safeParse(leadId).success) notFound();

  // Scoped to this organisation and to RLS: a UUID from another tenant is simply "not found".
  const lead = await getLead(org.id, leadId);
  if (!lead) notFound();

  const [events, team] = await Promise.all([listLeadEvents(org.id, lead.id), listTeam(org.id)]);
  const names = new Map(
    team.map((m) => [m.user_id, m.profiles?.full_name || m.profiles?.email || "A team member"]),
  );
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
          {lead.enquiry_message ? (
            <Card className="space-y-2">
              <h2 className="text-lg font-semibold">Customer&apos;s message</h2>
              <p className="text-sm whitespace-pre-wrap">{lead.enquiry_message}</p>
            </Card>
          ) : null}
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
