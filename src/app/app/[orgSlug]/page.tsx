import type { Metadata } from "next";
import Link from "next/link";
import { DueBadge } from "@/components/follow-ups/follow-up-item";
import { Card } from "@/components/ui/card";
import { listTeam, requireOrganisation } from "@/lib/auth/dal";
import { listOpenFollowUps } from "@/lib/follow-ups/queries";
import { formatDue } from "@/lib/follow-ups/time";
import { LEAD_STAGES, STAGE_LABELS } from "@/lib/leads/constants";
import { countLeadsByStage } from "@/lib/leads/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function OrgDashboardPage({ params }: PageProps<"/app/[orgSlug]">) {
  const { orgSlug } = await params;
  const org = await requireOrganisation(orgSlug);
  const [team, counts, followUps] = await Promise.all([
    listTeam(org.id),
    countLeadsByStage(org.id),
    listOpenFollowUps(org.id),
  ]);
  const now = new Date();
  const actionable = [...followUps.overdue, ...followUps.today];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-muted text-sm">Your role: {org.role}</p>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-muted text-sm font-medium">Pipeline</h2>
          <Link href={`/app/${org.slug}/leads`} className="text-brand text-sm hover:underline">
            View leads
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {LEAD_STAGES.map((stage) => (
            <Link
              key={stage}
              href={`/app/${org.slug}/leads?stage=${stage}`}
              className="bg-brand-soft rounded-lg p-3 hover:opacity-90"
            >
              <dt className="text-muted text-xs">{STAGE_LABELS[stage]}</dt>
              <dd className="text-2xl font-semibold">{counts[stage]}</dd>
            </Link>
          ))}
        </dl>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-muted text-sm font-medium">Follow-ups to do</h2>
            <Link
              href={`/app/${org.slug}/follow-ups`}
              className="text-brand text-sm hover:underline"
            >
              View all
            </Link>
          </div>
          <p className="text-sm">
            <span
              className={
                followUps.overdue.length > 0 ? "text-danger font-semibold" : "font-semibold"
              }
            >
              {followUps.overdue.length} overdue
            </span>
            {" · "}
            <span className="font-semibold">{followUps.today.length} due today</span>
          </p>
          {actionable.length === 0 ? (
            <p className="text-muted text-sm">
              Nothing to do right now. Schedule follow-ups from a lead.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {actionable.slice(0, 5).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link
                    href={`/app/${org.slug}/leads/${f.lead_id}`}
                    className="min-w-0 hover:underline"
                  >
                    <span className="block truncate font-medium">{f.leads?.name ?? "Lead"}</span>
                    <span className="text-muted block truncate text-xs">
                      {f.note || "Follow up"} · {formatDue(f.due_at, now)}
                    </span>
                  </Link>
                  <DueBadge dueAt={f.due_at} now={now} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-muted text-sm font-medium">Team</h2>
          <ul className="divide-border mt-2 divide-y">
            {team.map((member) => (
              <li
                key={member.user_id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="truncate">
                  {member.profiles?.full_name || member.profiles?.email || "Member"}
                </span>
                <span className="bg-brand-soft rounded-full px-2 py-0.5 text-xs">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
