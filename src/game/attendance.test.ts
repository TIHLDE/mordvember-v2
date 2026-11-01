import { describe, expect, it } from "vitest";
import {
  type AttendanceSession,
  closeTimeFor,
  countingDays,
  dayResults,
  type WeekRules,
  distanceMeters,
  evaluateWeek,
  sessionCountsAt,
  sessionMinutesInWindow,
} from "./attendance";
import { osloTime, weekStartOf } from "./time";

// Fixed here so the tests don't change when the game defaults do.
const RULES: WeekRules = { days: 2, hours: 2, windowStart: "08:00", windowEnd: "16:00", killsRequired: 0 };
const week = "2026-11-02";
const at = (date: string, time: string) => osloTime(date, time);
const later = at("2026-11-09", "12:00");

function s(date: string, from: string, to: string | null, over: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    checkInAt: at(date, from),
    checkOutAt: to ? at(date, to) : null,
    autoClosed: false,
    approved: false,
    rejected: false,
    ...over,
  };
}

describe("tid i Oslo", () => {
  it("mandag er ukestart, også over sommertid-skiftet", () => {
    expect(weekStartOf(at("2026-11-05", "10:00"))).toBe(week);
    expect(weekStartOf(at("2026-11-08", "23:59"))).toBe(week);
    expect(weekStartOf(at("2026-11-09", "00:01"))).toBe("2026-11-09");
    expect(weekStartOf(at("2026-10-25", "12:00"))).toBe("2026-10-19");
    expect(at("2026-10-26", "08:00").toISOString()).toBe("2026-10-26T07:00:00.000Z");
    expect(at("2026-10-23", "08:00").toISOString()).toBe("2026-10-23T06:00:00.000Z");
  });
});

describe("oppmøteregelen", () => {
  it("to timer sammenhengende teller", () => {
    expect(dayResults([s("2026-11-02", "09:00", "11:00")], week, RULES, later)[0]?.counts).toBe(true);
  });

  it("ett minutt for lite teller ikke", () => {
    expect(dayResults([s("2026-11-02", "09:00", "10:59")], week, RULES, later)[0]?.counts).toBe(false);
  });

  it("to korte økter samme dag legges ikke sammen", () => {
    const sessions = [s("2026-11-02", "09:00", "10:00"), s("2026-11-02", "10:05", "11:05")];
    expect(countingDays(sessions, week, RULES, later)).toBe(0);
  });

  it("bare tiden innenfor 08–16 teller", () => {
    expect(sessionMinutesInWindow(s("2026-11-02", "07:00", "09:30"), RULES, later)).toBe(90);
    expect(sessionMinutesInWindow(s("2026-11-02", "15:00", "18:00"), RULES, later)).toBe(60);
    expect(sessionMinutesInWindow(s("2026-11-02", "06:00", "07:59"), RULES, later)).toBe(0);
  });

  it("helg teller ikke", () => {
    expect(countingDays([s("2026-11-07", "09:00", "15:00")], week, RULES, later)).toBe(0);
  });

  it("glemt utsjekk teller ikke uten manuell godkjenning", () => {
    const forgotten = s("2026-11-03", "09:00", "16:00", { autoClosed: true });
    expect(countingDays([forgotten], week, RULES, later)).toBe(0);
    expect(dayResults([forgotten], week, RULES, later)[1]?.hasUnclosed).toBe(true);
    expect(countingDays([{ ...forgotten, approved: true }], week, RULES, later)).toBe(1);
  });

  it("åpen økt etter 16 teller ikke selv før cron har lukket den", () => {
    expect(countingDays([s("2026-11-03", "09:00", null)], week, RULES, later)).toBe(0);
  });

  it("pågående økt teller fram til nå", () => {
    const now = at("2026-11-03", "11:30");
    expect(sessionMinutesInWindow(s("2026-11-03", "09:00", null), RULES, now)).toBe(150);
  });

  it("underkjent innsjekk teller ikke", () => {
    expect(countingDays([s("2026-11-02", "09:00", "12:00", { rejected: true })], week, RULES, later)).toBe(0);
  });

  it("flere dager telles hver for seg", () => {
    const sessions = [
      s("2026-11-02", "09:00", "11:00"),
      s("2026-11-03", "08:00", "16:00"),
      s("2026-11-04", "12:00", "13:00"),
    ];
    expect(countingDays(sessions, week, RULES, later)).toBe(2);
  });

  it("endrede regler for en uke gjelder", () => {
    const rules = { ...RULES, hours: 3, windowStart: "10:00", windowEnd: "14:00" };
    expect(countingDays([s("2026-11-02", "09:00", "13:30")], week, rules, later)).toBe(1);
    expect(countingDays([s("2026-11-02", "09:00", "12:30")], week, rules, later)).toBe(0);
  });

  it("utsjekk lukkes kl. 16", () => {
    expect(closeTimeFor(at("2026-11-03", "09:00"), RULES).toISOString()).toBe(at("2026-11-03", "16:00").toISOString());
  });

  it("avstand", () => {
    expect(Math.round(distanceMeters({ lat: 63.4, lng: 10.4 }, { lat: 63.401, lng: 10.4 }))).toBe(111);
  });
});

describe("når dagen teller", () => {
  it("regnes fra innsjekk, eller fra vinduets start ved tidlig innsjekk", () => {
    expect(sessionCountsAt(at(week, "09:15"), RULES)).toEqual({ at: at(week, "11:15"), reachable: true });
    expect(sessionCountsAt(at(week, "07:00"), RULES)).toEqual({ at: at(week, "10:00"), reachable: true });
  });

  it("bruker sekundene i innsjekken", () => {
    const checkIn = new Date(at(week, "13:59").getTime() + 30_000);
    expect(sessionCountsAt(checkIn, RULES)).toEqual({ at: new Date(at(week, "15:59").getTime() + 30_000), reachable: true });
  });

  it("er ikke mulig når vinduet stenger før kravet er nådd", () => {
    expect(sessionCountsAt(at(week, "14:00"), RULES).reachable).toBe(true);
    expect(sessionCountsAt(at(week, "14:01"), RULES).reachable).toBe(false);
  });
});

describe("ukesjekken", () => {
  const base = { weekStart: week, requirementsFromWeek: null, killTimes: [], rules: RULES, now: later };

  it("godkjent med to dager", () => {
    const res = evaluateWeek({ ...base, sessions: [s("2026-11-02", "09:00", "11:00"), s("2026-11-04", "09:00", "11:00")] });
    expect(res.ok).toBe(true);
    expect(res.missing).toEqual([]);
  });

  it("forklarer hva som mangler", () => {
    const res = evaluateWeek({ ...base, sessions: [s("2026-11-02", "09:00", "11:00")] });
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual(["Mangler 1 oppmøtedag (har 1 av 2)"]);
  });

  it("drapskrav", () => {
    const rules = { ...RULES, days: 0, killsRequired: 1 };
    expect(evaluateWeek({ ...base, rules, sessions: [] }).missing).toEqual(["Mangler 1 drap (har 0 av 1)"]);
    expect(evaluateWeek({ ...base, rules, sessions: [], killTimes: [at("2026-11-03", "12:00")] }).ok).toBe(true);
    expect(evaluateWeek({ ...base, rules, sessions: [], killTimes: [at("2026-11-10", "12:00")] }).ok).toBe(false);
  });

  it("drap teller fra mandag 00:00 til søndag 23:59", () => {
    const rules = { ...RULES, days: 0, killsRequired: 1 };
    const kills = (time: Date) => evaluateWeek({ ...base, rules, sessions: [], killTimes: [time] }).kills;
    expect(kills(at("2026-11-02", "00:00"))).toBe(1);
    expect(kills(at("2026-11-07", "12:00"))).toBe(1);
    expect(kills(at("2026-11-08", "23:59"))).toBe(1);
    expect(kills(at("2026-11-01", "23:59"))).toBe(0);
    expect(kills(at("2026-11-09", "00:00"))).toBe(0);
  });

  it("helgedrap teller ikke som oppmøte", () => {
    const res = evaluateWeek({ ...base, sessions: [s("2026-11-07", "09:00", "11:00")], killTimes: [at("2026-11-07", "12:00")] });
    expect(res.countingDays).toBe(0);
    expect(res.kills).toBe(1);
  });

  it("nådde spillere slipper krav til uka etter", () => {
    expect(evaluateWeek({ ...base, sessions: [], requirementsFromWeek: "2026-11-09" }).ok).toBe(true);
    expect(evaluateWeek({ ...base, sessions: [], requirementsFromWeek: week }).ok).toBe(false);
  });
});
