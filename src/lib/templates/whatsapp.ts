/** Normalises a South African or international number to digits for a wa.me link, or null. */
export function toWhatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (trimmed.startsWith("+")) digits = digits.replace(/^0+/, "");
  else if (digits.startsWith("0")) digits = `27${digits.slice(1)}`;

  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** Click-to-chat link (opens WhatsApp with the message prefilled; not an API integration). */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const number = toWhatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}
