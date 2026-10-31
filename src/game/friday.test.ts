import { describe, expect, it } from "vitest";
import { type AttendanceSession, evaluateWeek, type WeekRules } from "./attendance";
import { earlierGameWeeks, fridayListDueAt, listWeekError } from "./friday";
import { osloTime } from "./time";

const RULES: WeekRules = { days: 1, hours: 2, windowStart: "08:00", windowEnd: "16:00", killsRequired: 1 };
const start = osloTime("2026-11-02", "09:00");
const week1 = "2026-11-02";
const week2 = "2026-11-09";
const week3 = "2026-11-16";
const tuesdayWeek2 = osloTime("2026-11-10", "12:00");

describe("fredagslistas frist", () => {
  it("er fredag kl. 16 i Oslo, også vinterstid", () => {
    expect(fridayListDueAt(week1).toISOString()).toBe("2026-11-06T15:00:00.000Z");
  });
});

describe("uka som velges", () => {
  it("godtar inneværende og tidligere uker i spillet", () => {
    expect(listWeekError(week2, start, tuesdayWeek2)).toBeNull();
    expect(listWeekError(week1, start, tuesdayWeek2)).toBeNull();
  });

  it("godtar første uke selv om spillet startet midt i den", () => {
    expect(listWeekError(week1, osloTime("2026-11-04", "12:00"), tuesdayWeek2)).toBeNull();
  });

  it("avviser framtidige uker", () => {
    expect(listWeekError(week3, start, tuesdayWeek2)).toBe("Uka har ikke startet ennå");
  });

  it("avviser uker før spillet startet", () => {
    expect(listWeekError("2026-10-26", start, tuesdayWeek2)).toBe("Spillet hadde ikke startet den uka");
  });

  it("avviser alt som ikke er en mandag", () => {
    for (const week of ["", "forrige", "2026-11-03", "2026-02-30", "2026-13-02", "2026-11-02T00:00", "2026-11-02' or 1=1"]) {
      expect(listWeekError(week, start, tuesdayWeek2)).toBe("Ugyldig uke");
    }
  });
});

describe("tidligere uker", () => {
  it("er tom i første uke", () => {
    expect(earlierGameWeeks(start, osloTime("2026-11-06", "17:00"))).toEqual([]);
  });

  it("ramser opp ukene bakover til spillet startet", () => {
    expect(earlierGameWeeks(start, osloTime("2026-11-16", "00:01"))).toEqual([week2, week1]);
  });
});

describe("vurdering av en tidligere uke", () => {
  const sunday = osloTime("2026-11-08", "23:59");
  const later = osloTime("2026-11-23", "12:00");
  const session = (over: Partial<AttendanceSession>): AttendanceSession => ({
    checkInAt: osloTime("2026-11-03", "09:00"),
    checkOutAt: osloTime("2026-11-03", "12:00"),
    autoClosed: false,
    approved: false,
    rejected: false,
    ...over,
  });
  const evaluate = (sessions: AttendanceSession[], now: Date) =>
    evaluateWeek({ weekStart: week1, requirementsFromWeek: null, sessions, killTimes: [osloTime("2026-11-04", "12:00")], rules: RULES, now });

  it("gir samme svar uansett når lista lages", () => {
    const sessions = [session({})];
    expect(evaluate(sessions, later)).toEqual(evaluate(sessions, sunday));
    expect(evaluate(sessions, later).ok).toBe(true);
  });

  it("teller ikke en økt som ble stående åpen fordi cron ikke kjørte", () => {
    expect(evaluate([session({ checkOutAt: null })], later).countingDays).toBe(0);
  });

  it("teller ikke en automatisk lukket økt uten godkjenning", () => {
    expect(evaluate([session({ autoClosed: true })], later).countingDays).toBe(0);
    expect(evaluate([session({ autoClosed: true, approved: true })], later).countingDays).toBe(1);
  });

  it("teller en åpen økt spillmesteren har godkjent, men bare innenfor vinduet", () => {
    expect(evaluate([session({ checkOutAt: null, approved: true })], later).countingDays).toBe(1);
  });
});
