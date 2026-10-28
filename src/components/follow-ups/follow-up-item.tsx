import Link from "next/link";
import { FollowUpActions } from "@/components/follow-ups/follow-up-actions";
import { StageBadge } from "@/components/leads/stage-badge";
import { classifyDue, daysOverdue, formatDue, todaySastDate } from "@/lib/follow-ups/time";
import type { FollowUp, FollowUpWithLead } from "@/lib/types";
import { cn } from "@/lib/utils";
import { completeFollowUp, skipFollowUp } from "@/app/app/[orgSlug]/follow-ups/actions";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DueBadge({ dueAt, now }: { dueAt: string; now: Date }) {
  const bucket = classifyDue(dueAt, now);
  if (bucket === "upcoming") return null;
  const days = daysOverdue(dueAt, now);
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
        bucket === "overdue" ? "bg-danger-soft text-danger" : "bg-brand-soft text-foreground",
      )}
    >
      {bucket === "overdue" ? (days > 0 ? `Overdue ${days}d` : "Overdue") : "Due today"}
    </span>
  );
}

export function FollowUpItem({
  followUp,
  orgSlug,
  now,
  nameOf,
  showLead,
}: {
  followUp: FollowUp | FollowUpWithLead;
  orgSlug: string;
  now: Date;
  nameOf: (id: string | null) => string;
  showLead?: boolean;
}) {
  const lead = "leads" in followUp ? followUp.leads : null;
  const today = todaySastDate(now);

  return (
    <li className="border-border bg-card space-y-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          {showLead && lead ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/app/${orgSlug}/leads/${followUp.lead_id}`}
                className="truncate font-medium hover:underline"
              >
                {lead.name}
              </Link>
              <StageBadge stage={lead.stage} />
            </div>
          ) : null}
          <p className="text-sm">{followUp.note || "Follow up"}</p>
          <p className="text-muted text-xs">
            {formatDue(followUp.due_at, now)} ·{" "}
            {followUp.assigned_to ? nameOf(followUp.assigned_to) : "Unassigned"}
          </p>
        </div>
        <DueBadge dueAt={followUp.due_at} now={now} />
      </div>
      <FollowUpActions
        complete={completeFollowUp.bind(null, orgSlug, followUp.id)}
        skip={skipFollowUp.bind(null, orgSlug, followUp.id)}
        minDate={today}
        defaultNextDate={addDays(today, 2)}
      />
    </li>
  );
}
