import type { LeadEvent } from "@/lib/types";
import { formatDue } from "@/lib/follow-ups/time";
import { STAGE_LABELS, SOURCE_LABELS, type LeadSource } from "./constants";

/** Plain-language description of a history entry. `nameOf` resolves a user id to a display name. */
export function describeEvent(event: LeadEvent, nameOf: (userId: string | null) => string): string {
  const actor = nameOf(event.actor_id);
  const from = event.from_stage ? STAGE_LABELS[event.from_stage] : null;
  const to = event.to_stage ? STAGE_LABELS[event.to_stage] : null;

  switch (event.type) {
    case "created": {
      const source = event.meta.source as LeadSource | undefined;
      const via =
        source && SOURCE_LABELS[source] ? ` via ${SOURCE_LABELS[source].toLowerCase()}` : "";
      return `${actor} added this lead${via}`;
    }
    case "stage_changed": {
      const reason =
        typeof event.meta.lost_reason === "string" ? `. Reason: ${event.meta.lost_reason}` : "";
      return `${actor} moved this lead from ${from} to ${to}${reason}`;
    }
    case "reopened": {
      const previous = event.meta.previous_outcome === "won" ? "won" : "lost";
      return `${actor} reopened this lead (was ${previous}) and moved it to ${to}`;
    }
    case "follow_up_created": {
      const due =
        typeof event.meta.due_at === "string" ? ` for ${formatDue(event.meta.due_at)}` : "";
      const note =
        typeof event.meta.note === "string" && event.meta.note ? `: ${event.meta.note}` : "";
      return `${actor} scheduled a follow-up${due}${note}`;
    }
    case "follow_up_done": {
      const outcome =
        typeof event.meta.outcome === "string" ? `. Outcome: ${event.meta.outcome}` : "";
      return `${actor} completed a follow-up${outcome}`;
    }
    case "follow_up_skipped": {
      const reason = typeof event.meta.outcome === "string" ? `. ${event.meta.outcome}` : "";
      return `${actor} skipped a follow-up${reason}`;
    }
    case "updated": {
      if (event.meta.field === "assigned_to") {
        const target = typeof event.meta.to === "string" ? nameOf(event.meta.to) : null;
        return target
          ? `${actor} assigned this lead to ${target}`
          : `${actor} unassigned this lead`;
      }
      return `${actor} updated this lead`;
    }
  }
}
