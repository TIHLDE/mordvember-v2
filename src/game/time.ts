const TIME_ZONE = "Europe/Oslo";

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type OsloParts = {
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  isoWeekday: number;
};

export function osloParts(at: Date): OsloParts {
  const get = (type: string) =>
    partsFormat.formatToParts(at).find((p) => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    year,
    month,
    day,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    isoWeekday: WEEKDAYS.indexOf(get("weekday")) + 1,
  };
}

export function osloDate(at: Date): string {
  return osloParts(at).date;
}

function offsetMinutes(at: Date): number {
  const p = osloParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

export function osloTime(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let result = new Date(guess - offsetMinutes(new Date(guess)) * 60000);
  const corrected = new Date(guess - offsetMinutes(result) * 60000);
  if (corrected.getTime() !== result.getTime()) result = corrected;
  return result;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function weekStartOf(at: Date): string {
  const p = osloParts(at);
  return addDays(p.date, 1 - p.isoWeekday);
}

export function weekdaysOf(weekStart: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));
}

const timeFormat = new Intl.DateTimeFormat("nb-NO", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const dateTimeFormat = new Intl.DateTimeFormat("nb-NO", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat("nb-NO", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function formatOslo(at: Date, withDate = true): string {
  return (withDate ? dateTimeFormat : timeFormat).format(at);
}

export function formatOsloDate(date: string): string {
  return dateFormat.format(new Date(`${date}T12:00:00Z`));
}
