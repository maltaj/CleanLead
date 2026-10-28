import { z } from "zod";
import { sastToIso } from "@/lib/follow-ups/time";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v));

const assignee = z
  .string()
  .trim()
  .refine((v) => v === "" || z.uuid().safeParse(v).success, "Choose a team member.")
  .transform((v) => (v === "" ? null : v));

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/** Date + time in SAST -> UTC ISO string, with a sanity window. */
function dueToIso(date: string, time: string, ctx: z.RefinementCtx, path: string): string | null {
  const iso = sastToIso(date, time === "" ? "09:00" : time);
  if (!iso) {
    ctx.addIssue({ code: "custom", path: [path], message: "Enter a valid date and time." });
    return null;
  }
  if (new Date(iso).getTime() > Date.now() + TWO_YEARS_MS) {
    ctx.addIssue({
      code: "custom",
      path: [path],
      message: "Choose a date within the next two years.",
    });
    return null;
  }
  return iso;
}

export const createFollowUpSchema = z
  .object({
    dueDate: z.string().trim().min(1, "Choose a due date."),
    dueTime: z.string().trim(),
    note: optionalText(300),
    assignedTo: assignee,
  })
  .transform((v, ctx) => {
    const dueAt = dueToIso(v.dueDate, v.dueTime, ctx, "dueDate");
    if (!dueAt) return z.NEVER;
    return { dueAt, note: v.note, assignedTo: v.assignedTo };
  });

export const completeFollowUpSchema = z
  .object({
    outcome: z
      .string()
      .trim()
      .min(1, "Record what happened.")
      .max(500, "Use 500 characters or fewer."),
    nextDate: z.string().trim(),
    nextTime: z.string().trim(),
    nextNote: optionalText(300),
  })
  .transform((v, ctx) => {
    const nextDueAt = v.nextDate === "" ? null : dueToIso(v.nextDate, v.nextTime, ctx, "nextDate");
    if (v.nextDate !== "" && !nextDueAt) return z.NEVER;
    return { outcome: v.outcome, nextDueAt, nextNote: v.nextDate === "" ? null : v.nextNote };
  });

export const skipFollowUpSchema = z.object({ reason: optionalText(300) });

export const templateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the template a name.")
    .max(80, "Use 80 characters or fewer."),
  body: z.string().trim().min(1, "Write the message.").max(2000, "Use 2000 characters or fewer."),
});
