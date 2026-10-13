import { osloDate, osloTime, weekdaysOf } from "./time";

export type WeekRules = {
  days: number;
  hours: number;
  windowStart: string;
  windowEnd: string;
  killsRequired: number;
};

export const DEFAULT_RULES: WeekRules = {
  days: 2,
  hours: 2,
  windowStart: "08:00",
  windowEnd: "16:00",
  killsRequired: 0,
};

export type AttendanceSession = {
  checkInAt: Date;
  checkOutAt: Date | null;
  autoClosed: boolean;
  approved: boolean;
  rejected: boolean;
};

export type DayResult = {
  date: string;
  longestMinutes: number;
  counts: boolean;
  hasUnclosed: boolean;
};

export function sessionMinutesInWindow(session: AttendanceSession, rules: WeekRules, now: Date): number {
  if (session.rejected) return 0;
  if (session.autoClosed && !session.approved) return 0;
  const date = osloDate(session.checkInAt);
  const windowStart = osloTime(date, rules.windowStart);
  const windowEnd = osloTime(date, rules.windowEnd);
  const end = session.checkOutAt ?? (now < windowEnd ? now : windowEnd);
  if (!session.checkOutAt && now >= windowEnd && !session.approved) return 0;
  const from = Math.max(session.checkInAt.getTime(), windowStart.getTime());
  const to = Math.min(end.getTime(), windowEnd.getTime());
  return Math.max(0, Math.floor((to - from) / 60000));
}

export function dayResults(
  sessions: readonly AttendanceSession[],
  weekStart: string,
  rules: WeekRules,
  now: Date,
): DayResult[] {
  return weekdaysOf(weekStart).map((date) => {
    const ofDay = sessions.filter((s) => osloDate(s.checkInAt) === date);
    const longestMinutes = Math.max(0, ...ofDay.map((s) => sessionMinutesInWindow(s, rules, now)));
    return {
      date,
      longestMinutes,
      counts: longestMinutes >= rules.hours * 60,
      hasUnclosed: ofDay.some((s) => s.autoClosed && !s.approved && !s.rejected),
    };
  });
}

export function countingDays(
  sessions: readonly AttendanceSession[],
  weekStart: string,
  rules: WeekRules,
  now: Date,
): number {
  return dayResults(sessions, weekStart, rules, now).filter((d) => d.counts).length;
}

export type WeekEvaluation = {
  exempt: boolean;
  countingDays: number;
  kills: number;
  ok: boolean;
  missing: string[];
};

export function evaluateWeek(input: {
  weekStart: string;
  requirementsFromWeek: string | null;
  sessions: readonly AttendanceSession[];
  killTimes: readonly Date[];
  rules: WeekRules;
  now: Date;
}): WeekEvaluation {
  const { weekStart, rules, now } = input;
  const exempt = input.requirementsFromWeek !== null && input.requirementsFromWeek > weekStart;
  const days = countingDays(input.sessions, weekStart, rules, now);
  const weekDates = new Set(weekdaysOf(weekStart));
  const kills = input.killTimes.filter((t) => weekDates.has(osloDate(t))).length;
  const missing: string[] = [];
  if (!exempt) {
    if (days < rules.days) {
      const lacking = rules.days - days;
      missing.push(`Mangler ${lacking} oppmøtedag${lacking === 1 ? "" : "er"} (har ${days} av ${rules.days})`);
    }
    if (kills < rules.killsRequired) {
      const lacking = rules.killsRequired - kills;
      missing.push(`Mangler ${lacking} drap (har ${kills} av ${rules.killsRequired})`);
    }
  }
  return { exempt, countingDays: days, kills, ok: missing.length === 0, missing };
}

export function closeTimeFor(checkInAt: Date, rules: WeekRules): Date {
  return osloTime(osloDate(checkInAt), rules.windowEnd);
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
