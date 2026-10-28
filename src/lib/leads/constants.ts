export const LEAD_STAGES = ["new", "contacted", "quote_sent", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  quote_sent: "Quote sent",
  won: "Won",
  lost: "Lost",
};

export const OPEN_STAGES: LeadStage[] = ["new", "contacted", "quote_sent"];

export const LEAD_SOURCES = [
  "phone",
  "whatsapp",
  "website_form",
  "referral",
  "walk_in",
  "social",
  "other",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  phone: "Phone call",
  whatsapp: "WhatsApp",
  website_form: "Website form",
  referral: "Referral",
  walk_in: "Walk-in",
  social: "Social media",
  other: "Other",
};

// Starting list only; custom service types arrive in a later milestone.
export const DEFAULT_SERVICE_TYPES = [
  "General cleaning",
  "Deep cleaning",
  "Move-in / move-out",
  "Office cleaning",
  "Carpet & upholstery",
  "Windows",
  "Post-construction",
  "Airbnb turnover",
] as const;

export const PAGE_SIZE = 25;

export function isLeadStage(value: unknown): value is LeadStage {
  return typeof value === "string" && (LEAD_STAGES as readonly string[]).includes(value);
}
