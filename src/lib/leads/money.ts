export const MAX_VALUE_CENTS = 100_000_000; // R1 000 000, matches the database check

export type MoneyParse = { ok: true; cents: number | null } | { ok: false };

/** Parses a rand amount typed by a person ("1500", "R1 500,50", "1,500.00") into cents. */
export function parseRandsToCents(input: string): MoneyParse {
  const cleaned = input.replace(/^\s*r\s*/i, "").replace(/\s+/g, "");
  if (cleaned === "") return { ok: true, cents: null };

  let normalised: string | null = null;
  if (/^\d+([.,]\d{1,2})?$/.test(cleaned)) {
    normalised = cleaned.replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    normalised = cleaned.replace(/,/g, "");
  }
  if (normalised === null) return { ok: false };

  const [whole, fraction = ""] = normalised.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_VALUE_CENTS) return { ok: false };
  return { ok: true, cents };
}

export function formatZar(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "–";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function centsToRandsInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
