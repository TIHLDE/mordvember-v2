import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, weeklyWarningDue, type WeekEvaluation } from "./attendance";
import { osloTime } from "./time";

const rules = { ...DEFAULT_RULES, days: 3 };
const evaluation: WeekEvaluation = { exempt: false, countingDays: 1, kills: 0, ok: false, missing: ["attendance"] };

describe("weekly attendance warnings", () => {
  it("warns Sunday for five required days in the upcoming week", () => {
    const fiveDays = { ...rules, days: 5 };
    const missingFive = { ...evaluation, countingDays: 0 };
    expect(weeklyWarningDue(missingFive, fiveDays, osloTime("2026-11-01", "15:59"), "2026-11-02")).toBe(false);
    expect(weeklyWarningDue(missingFive, fiveDays, osloTime("2026-11-01", "16:00"), "2026-11-02")).toBe(true);
    expect(weeklyWarningDue(missingFive, fiveDays, osloTime("2026-11-02", "07:00"), "2026-11-02")).toBe(true);
  });
  it("warns Wednesday at 16 when two days remain", () => {
    expect(weeklyWarningDue(evaluation, rules, osloTime("2026-11-04", "15:59"))).toBe(false);
    expect(weeklyWarningDue(evaluation, rules, osloTime("2026-11-04", "16:00"))).toBe(true);
  });
  it("moves earlier for three missing days and later for one", () => {
    expect(weeklyWarningDue({ ...evaluation, countingDays: 0 }, rules, osloTime("2026-11-03", "16:00"))).toBe(true);
    expect(weeklyWarningDue({ ...evaluation, countingDays: 2 }, rules, osloTime("2026-11-04", "16:00"))).toBe(false);
    expect(weeklyWarningDue({ ...evaluation, countingDays: 2 }, rules, osloTime("2026-11-05", "16:00"))).toBe(true);
  });
  it("skips satisfied and exempt participants", () => {
    const now = osloTime("2026-11-05", "16:00");
    expect(weeklyWarningDue({ ...evaluation, ok: true }, rules, now)).toBe(false);
    expect(weeklyWarningDue({ ...evaluation, exempt: true }, rules, now)).toBe(false);
  });
  it("keeps Thursday warnings for missing kills", () => {
    const killsOnly = { ...evaluation, countingDays: 3, missing: ["kills"] };
    expect(weeklyWarningDue(killsOnly, rules, osloTime("2026-11-04", "16:00"))).toBe(false);
    expect(weeklyWarningDue(killsOnly, rules, osloTime("2026-11-05", "16:00"))).toBe(true);
  });
});
