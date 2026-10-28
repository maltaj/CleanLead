import { describe, expect, it } from "vitest";
import {
  classifyDue,
  daysOverdue,
  formatDue,
  sastDayBounds,
  sastToIso,
  toSastFields,
  todaySastDate,
} from "./time";

// 2026-10-28 10:00 SAST = 08:00 UTC
const NOW = new Date("2026-10-28T08:00:00Z");

describe("sastToIso", () => {
  it("converts SAST to UTC", () => {
    expect(sastToIso("2026-11-02", "09:00")).toBe("2026-11-02T07:00:00.000Z");
    expect(sastToIso("2026-11-02", "00:30")).toBe("2026-11-01T22:30:00.000Z");
  });

  it("defaults to 09:00", () => {
    expect(sastToIso("2026-11-02")).toBe("2026-11-02T07:00:00.000Z");
  });

  it.each([
    ["2026-02-30", "09:00"],
    ["2026-13-01", "09:00"],
    ["26-11-02", "09:00"],
    ["2026-11-02", "25:00"],
    ["2026-11-02", "9:00"],
    ["", ""],
  ])("rejects %s %s", (date, time) => {
    expect(sastToIso(date, time)).toBeNull();
  });
});

describe("toSastFields", () => {
  it("round-trips with sastToIso", () => {
    const iso = sastToIso("2026-12-31", "23:45")!;
    expect(toSastFields(iso)).toEqual({ date: "2026-12-31", time: "23:45" });
  });

  it("uses the SAST date near midnight UTC", () => {
    expect(todaySastDate(new Date("2026-10-27T23:30:00Z"))).toBe("2026-10-28");
  });
});

describe("sastDayBounds", () => {
  it("returns SAST midnight boundaries", () => {
    const { startOfToday, startOfTomorrow } = sastDayBounds(NOW);
    expect(startOfToday.toISOString()).toBe("2026-10-27T22:00:00.000Z");
    expect(startOfTomorrow.toISOString()).toBe("2026-10-28T22:00:00.000Z");
  });
});

describe("classifyDue", () => {
  it("separates overdue, today and upcoming", () => {
    expect(classifyDue("2026-10-28T07:00:00Z", NOW)).toBe("overdue");
    expect(classifyDue("2026-10-28T12:00:00Z", NOW)).toBe("today");
    expect(classifyDue("2026-10-28T21:59:00Z", NOW)).toBe("today");
    expect(classifyDue("2026-10-28T22:00:00Z", NOW)).toBe("upcoming");
    expect(classifyDue("2026-11-05T07:00:00Z", NOW)).toBe("upcoming");
  });
});

describe("formatDue and daysOverdue", () => {
  it("labels relative days", () => {
    expect(formatDue("2026-10-28T12:00:00Z", NOW)).toBe("Today 14:00");
    expect(formatDue("2026-10-29T07:00:00Z", NOW)).toBe("Tomorrow 09:00");
    expect(formatDue("2026-10-27T07:00:00Z", NOW)).toBe("Yesterday 09:00");
    expect(formatDue("2026-11-02T07:00:00Z", NOW)).toBe("Mon 2 Nov, 09:00");
  });

  it("counts overdue days", () => {
    expect(daysOverdue("2026-10-28T07:00:00Z", NOW)).toBe(0);
    expect(daysOverdue("2026-10-25T07:00:00Z", NOW)).toBe(3);
    expect(daysOverdue("2026-11-05T07:00:00Z", NOW)).toBe(0);
  });
});
