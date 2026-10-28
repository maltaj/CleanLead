export const TEMPLATE_FIELDS = [
  { key: "customer_name", label: "Customer name" },
  { key: "business_name", label: "Your business name" },
  { key: "service", label: "Service" },
  { key: "suburb", label: "Suburb" },
  { key: "quote_value", label: "Estimated value" },
  { key: "sender_name", label: "Your name" },
] as const;

export type TemplateFieldKey = (typeof TEMPLATE_FIELDS)[number]["key"];
export type TemplateVars = Partial<Record<TemplateFieldKey, string | null | undefined>>;

const FIELD_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;
const KNOWN = new Set<string>(TEMPLATE_FIELDS.map((f) => f.key));

/**
 * Replaces {{field}} placeholders. Known fields with no value become empty; unknown fields are
 * left as written so a typo is visible before the message is sent. Output is plain text.
 */
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(FIELD_RE, (match, key: string) => {
    if (!KNOWN.has(key)) return match;
    return vars[key as TemplateFieldKey] ?? "";
  });
}

export function unknownFields(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(FIELD_RE)) if (!KNOWN.has(m[1])) found.add(m[1]);
  return [...found];
}

export const STARTER_TEMPLATES: { name: string; body: string }[] = [
  {
    name: "Quote follow-up (gentle)",
    body: "Hi {{customer_name}}, it's {{sender_name}} from {{business_name}}. I just wanted to check in on the quote for {{service}}. Happy to answer any questions or adjust anything. Would you like me to book you in?",
  },
  {
    name: "Quote follow-up (second nudge)",
    body: "Hi {{customer_name}}, following up on our quote for {{service}}. Our diary fills up quickly. Let me know if you'd like to lock in a date. If it's no longer needed, no problem at all, just say so and I'll close it off.",
  },
  {
    name: "First response to an enquiry",
    body: "Hi {{customer_name}}, thanks for getting in touch with {{business_name}}. We'd love to help with {{service}}. When would suit you for a quick call, or can I send a quote based on a few details?",
  },
];
