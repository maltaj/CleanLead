import { z } from "zod";
import { DEFAULT_SERVICE_TYPES, LEAD_SOURCES, LEAD_STAGES } from "@/lib/leads/constants";
import { parseRandsToCents } from "@/lib/leads/money";

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v));

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, " "))
  .refine((v) => v === "" || /^\+?[0-9][0-9 ()-]{5,23}$/.test(v), "Enter a valid phone number.")
  .transform((v) => (v === "" ? null : v));

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address.")
  .refine((v) => v.length <= 254, "Use 254 characters or fewer.")
  .transform((v) => (v === "" ? null : v));

const valueSchema = z.string().transform((v, ctx) => {
  const parsed = parseRandsToCents(v);
  if (!parsed.ok) {
    ctx.addIssue({ code: "custom", message: "Enter an amount in rand, up to R1 000 000." });
    return z.NEVER;
  }
  return parsed.cents;
});

export const leadSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter the customer's name.")
      .max(120, "Use 120 characters or fewer."),
    phone: phoneSchema,
    email: emailField,
    suburb: optionalText(80),
    serviceType: z
      .string()
      .trim()
      .min(1, "Choose or enter a service.")
      .max(80, "Use 80 characters or fewer.")
      .default(DEFAULT_SERVICE_TYPES[0]),
    estValue: valueSchema,
    source: z.enum(LEAD_SOURCES, { error: "Choose where this enquiry came from." }),
    assignedTo: z
      .string()
      .trim()
      .refine((v) => v === "" || z.uuid().safeParse(v).success, "Choose a team member.")
      .transform((v) => (v === "" ? null : v)),
    notes: optionalText(2000),
  })
  .refine((v) => v.phone !== null || v.email !== null, {
    path: ["phone"],
    message: "Enter a phone number or an email address.",
  });

export type LeadInput = z.infer<typeof leadSchema>;

export const stageChangeSchema = z.object({
  stage: z.enum(LEAD_STAGES, { error: "Choose a stage." }),
  lostReason: optionalText(300),
});

export const uuidSchema = z.uuid();
