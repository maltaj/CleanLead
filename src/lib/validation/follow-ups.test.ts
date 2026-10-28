import { describe, expect, it } from "vitest";
import {
  completeFollowUpSchema,
  createFollowUpSchema,
  skipFollowUpSchema,
  templateSchema,
} from "./follow-ups";

describe("createFollowUpSchema", () => {
  it("builds a UTC due time from SAST fields", () => {
    const r = createFollowUpSchema.parse({
      dueDate: "2027-01-05",
      dueTime: "14:30",
      note: " Call ",
      assignedTo: "",
    });
    expect(r).toEqual({ dueAt: "2027-01-05T12:30:00.000Z", note: "Call", assignedTo: null });
  });

  it("defaults the time to 09:00", () => {
    const r = createFollowUpSchema.parse({
      dueDate: "2027-01-05",
      dueTime: "",
      note: "",
      assignedTo: "",
    });
    expect(r.dueAt).toBe("2027-01-05T07:00:00.000Z");
    expect(r.note).toBeNull();
  });

  it.each([
    { dueDate: "", dueTime: "09:00" },
    { dueDate: "2027-02-30", dueTime: "09:00" },
    { dueDate: "2027-01-05", dueTime: "99:99" },
    { dueDate: "2999-01-05", dueTime: "09:00" },
  ])("rejects %j", (input) => {
    expect(createFollowUpSchema.safeParse({ ...input, note: "", assignedTo: "" }).success).toBe(
      false,
    );
  });

  it("rejects a malformed assignee", () => {
    expect(
      createFollowUpSchema.safeParse({
        dueDate: "2027-01-05",
        dueTime: "",
        note: "",
        assignedTo: "nope",
      }).success,
    ).toBe(false);
  });
});

describe("completeFollowUpSchema", () => {
  it("requires an outcome", () => {
    expect(
      completeFollowUpSchema.safeParse({ outcome: "  ", nextDate: "", nextTime: "", nextNote: "" })
        .success,
    ).toBe(false);
  });

  it("allows completing without a next action", () => {
    const r = completeFollowUpSchema.parse({
      outcome: "Spoke to customer",
      nextDate: "",
      nextTime: "",
      nextNote: "ignored",
    });
    expect(r).toEqual({ outcome: "Spoke to customer", nextDueAt: null, nextNote: null });
  });

  it("schedules a next action", () => {
    const r = completeFollowUpSchema.parse({
      outcome: "No answer",
      nextDate: "2027-01-06",
      nextTime: "10:00",
      nextNote: "Try again",
    });
    expect(r.nextDueAt).toBe("2027-01-06T08:00:00.000Z");
    expect(r.nextNote).toBe("Try again");
  });

  it("rejects an invalid next date", () => {
    expect(
      completeFollowUpSchema.safeParse({
        outcome: "x",
        nextDate: "bad",
        nextTime: "",
        nextNote: "",
      }).success,
    ).toBe(false);
  });
});

describe("skipFollowUpSchema and templateSchema", () => {
  it("accepts an empty skip reason", () => {
    expect(skipFollowUpSchema.parse({ reason: "" }).reason).toBeNull();
  });

  it("bounds template fields", () => {
    expect(templateSchema.safeParse({ name: "", body: "x" }).success).toBe(false);
    expect(templateSchema.safeParse({ name: "x", body: "y".repeat(2001) }).success).toBe(false);
    expect(templateSchema.safeParse({ name: "Nudge", body: "Hi" }).success).toBe(true);
  });
});
