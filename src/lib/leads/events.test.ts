import { describe, expect, it } from "vitest";
import type { LeadEvent } from "@/lib/types";
import { describeEvent } from "./events";

const nameOf = (id: string | null) => (id === "u1" ? "Alice" : id === "u2" ? "Adam" : "Someone");
const base: LeadEvent = {
  id: 1,
  actor_id: "u1",
  type: "created",
  from_stage: null,
  to_stage: "new",
  meta: {},
  created_at: "2026-10-28T08:00:00Z",
};

describe("describeEvent", () => {
  it("describes creation with its source", () => {
    expect(describeEvent({ ...base, meta: { source: "whatsapp" } }, nameOf)).toBe(
      "Alice added this lead via whatsapp",
    );
  });

  it("describes stage changes and loss reasons", () => {
    const event: LeadEvent = {
      ...base,
      type: "stage_changed",
      from_stage: "quote_sent",
      to_stage: "lost",
      meta: { lost_reason: "Too expensive" },
    };
    expect(describeEvent(event, nameOf)).toBe(
      "Alice moved this lead from Quote sent to Lost. Reason: Too expensive",
    );
  });

  it("describes reopening with the previous outcome", () => {
    const event: LeadEvent = {
      ...base,
      type: "reopened",
      from_stage: "won",
      to_stage: "contacted",
      meta: { previous_outcome: "won" },
    };
    expect(describeEvent(event, nameOf)).toBe(
      "Alice reopened this lead (was won) and moved it to Contacted",
    );
  });

  it("describes assignment and unassignment", () => {
    const assigned: LeadEvent = {
      ...base,
      type: "updated",
      meta: { field: "assigned_to", to: "u2" },
    };
    const unassigned: LeadEvent = {
      ...base,
      type: "updated",
      meta: { field: "assigned_to", to: null },
    };
    expect(describeEvent(assigned, nameOf)).toBe("Alice assigned this lead to Adam");
    expect(describeEvent(unassigned, nameOf)).toBe("Alice unassigned this lead");
  });

  it("describes follow-up activity", () => {
    const created: LeadEvent = {
      ...base,
      type: "follow_up_created",
      meta: { due_at: "2026-11-02T07:00:00Z", note: "Call back" },
    };
    expect(describeEvent(created, nameOf)).toMatch(
      /^Alice scheduled a follow-up for .*09:00: Call back$/,
    );
    const done: LeadEvent = { ...base, type: "follow_up_done", meta: { outcome: "Quoted R1500" } };
    expect(describeEvent(done, nameOf)).toBe("Alice completed a follow-up. Outcome: Quoted R1500");
    const skipped: LeadEvent = {
      ...base,
      type: "follow_up_skipped",
      meta: { outcome: "Closed automatically: lead marked won" },
    };
    expect(describeEvent(skipped, nameOf)).toBe(
      "Alice skipped a follow-up. Closed automatically: lead marked won",
    );
  });
});
