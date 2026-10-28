import type { LeadEvent } from "@/lib/types";
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
