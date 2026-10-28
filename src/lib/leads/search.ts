/**
 * Makes free text safe to embed in a PostgREST `or(...)` ilike filter: removes the characters
 * that separate filters (`,`), group them (`()`), or act as wildcards (`%`, `_`, `*`, `\`).
 */
export function sanitizeSearchTerm(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .replace(/[,()%_*\\"'`;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
