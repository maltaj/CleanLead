/**
 * Only allow same-site relative paths as post-login destinations. Rejects absolute URLs,
 * protocol-relative URLs ("//evil.com"), backslash tricks and control characters.
 */
export function safeRedirectPath(input: string | null | undefined, fallback = "/app"): string {
  if (!input) return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(input)) return fallback;
  try {
    const url = new URL(input, "http://placeholder.invalid");
    if (url.origin !== "http://placeholder.invalid") return fallback;
  } catch {
    return fallback;
  }
  return input;
}
