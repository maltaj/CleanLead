// CleanLead's customers are South African, so "today" means South African Standard Time (UTC+2,
// no daylight saving). A per-organisation timezone can replace this constant later.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Converts a SAST calendar date ("2026-11-02") and time ("09:00") into a UTC ISO string. */
export function sastToIso(date: string, time = "09:00"): string | null {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time);
  if (!d || !t) return null;
  const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hour, minute] = [Number(t[1]), Number(t[2])];

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null; // e.g. 30 February
  }
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - SAST_OFFSET_MS).toISOString();
}

function sastParts(instant: Date) {
  const shifted = new Date(instant.getTime() + SAST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** SAST calendar date and time of an instant, as form-field values. */
export function toSastFields(iso: string): { date: string; time: string } {
  const p = sastParts(new Date(iso));
  return {
    date: `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}

export function todaySastDate(now: Date = new Date()): string {
  return toSastFields(now.toISOString()).date;
}

/** Start of the current SAST day and of the next one, as UTC instants. */
export function sastDayBounds(now: Date = new Date()): {
  startOfToday: Date;
  startOfTomorrow: Date;
} {
  const p = sastParts(now);
  const startOfToday = new Date(Date.UTC(p.year, p.month, p.day) - SAST_OFFSET_MS);
  return { startOfToday, startOfTomorrow: new Date(startOfToday.getTime() + DAY_MS) };
}

export type DueBucket = "overdue" | "today" | "upcoming";

/** Overdue = past its due time; today = later today (SAST); upcoming = tomorrow or later. */
export function classifyDue(dueIso: string, now: Date = new Date()): DueBucket {
  const due = new Date(dueIso);
  if (due.getTime() < now.getTime()) return "overdue";
  return due.getTime() < sastDayBounds(now).startOfTomorrow.getTime() ? "today" : "upcoming";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Short human label such as "Today 14:00", "Tomorrow 09:00" or "Mon 2 Nov, 09:00". */
export function formatDue(dueIso: string, now: Date = new Date()): string {
  const due = new Date(dueIso);
  const { time } = toSastFields(dueIso);
  const { startOfToday } = sastDayBounds(now);
  const dayDiff = Math.round(
    (sastDayBounds(due).startOfToday.getTime() - startOfToday.getTime()) / DAY_MS,
  );

  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Tomorrow ${time}`;
  if (dayDiff === -1) return `Yesterday ${time}`;
  const p = sastParts(due);
  const weekday = WEEKDAYS[new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay()];
  return `${weekday} ${p.day} ${MONTHS[p.month]}, ${time}`;
}

/** Whole days a follow-up is overdue (0 if not yet overdue). */
export function daysOverdue(dueIso: string, now: Date = new Date()): number {
  const diff =
    sastDayBounds(now).startOfToday.getTime() -
    sastDayBounds(new Date(dueIso)).startOfToday.getTime();
  return Math.max(0, Math.round(diff / DAY_MS));
}
