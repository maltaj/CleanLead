const TZ = "Africa/Johannesburg";

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: TZ }).format(
    new Date(iso),
  );
}
