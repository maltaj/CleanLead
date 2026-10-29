import { z } from "zod";
import { DEFAULT_SERVICE_TYPES } from "@/lib/leads/constants";
import { emailField, optionalText, phoneSchema } from "@/lib/validation/leads";

export const publicEnquirySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Please enter your name.")
      .max(120, "Use 120 characters or fewer."),
    phone: phoneSchema,
    email: emailField,
    suburb: optionalText(80),
    serviceType: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || (DEFAULT_SERVICE_TYPES as readonly string[]).includes(v),
        "Choose a service from the list.",
      )
      .transform((v) => (v === "" ? DEFAULT_SERVICE_TYPES[0] : v)),
    message: optionalText(1000),
    consent: z.literal("on", { error: "Please tick the box so we can contact you." }),
    // Honeypot: real people never see or fill this field.
    website: z.string().max(0).optional().default(""),
  })
  .refine((v) => v.phone !== null || v.email !== null, {
    path: ["phone"],
    message: "Please enter a phone number or an email address.",
  });

export type PublicEnquiryInput = z.infer<typeof publicEnquirySchema>;
