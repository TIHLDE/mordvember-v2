import { addDays, osloTime, weekStartOf } from "./time";

export function fridayListDueAt(weekStart: string): Date {
  return osloTime(addDays(weekStart, 4), "16:00");
}

// The form value is not trusted: a week is a real Monday, from the game's first week up to this one.
export function listWeekError(week: string, startedAt: Date, now: Date): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || weekStartOf(osloTime(week, "12:00")) !== week)
    return "Ugyldig uke";
  if (week > weekStartOf(now)) return "Uka har ikke startet ennå";
  if (week < weekStartOf(startedAt)) return "Spillet hadde ikke startet den uka";
  return null;
}

// Weeks of the game before the current one, newest first.
export function earlierGameWeeks(startedAt: Date, now: Date): string[] {
  const first = weekStartOf(startedAt);
  const weeks: string[] = [];
  for (let week = addDays(weekStartOf(now), -7); week >= first; week = addDays(week, -7))
    weeks.push(week);
  return weeks;
}
