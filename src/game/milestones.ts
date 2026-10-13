export type MilestoneRule = {
  key: string;
  label: string;
  kind: "percent" | "count" | "winner";
  value: number;
  email: boolean;
};

export const DEFAULT_MILESTONES: MilestoneRule[] = [
  { key: "halv", label: "Halvparten er borte", kind: "percent", value: 50, email: true },
  { key: "kvart", label: "Bare en firedel igjen", kind: "percent", value: 25, email: true },
  { key: "ti", label: "Ti spillere igjen", kind: "count", value: 10, email: true },
  { key: "tre", label: "Tre spillere igjen", kind: "count", value: 3, email: true },
  { key: "vinner", label: "Vi har en vinner", kind: "winner", value: 1, email: true },
];

function reached(rule: MilestoneRule, alive: number, total: number): boolean {
  if (rule.kind === "winner") return alive <= 1;
  if (rule.kind === "count") return alive <= rule.value;
  return alive * 100 <= total * rule.value;
}

export function crossedMilestones(
  rules: readonly MilestoneRule[],
  aliveBefore: number,
  aliveAfter: number,
  total: number,
  alreadyFired: ReadonlySet<string>,
): MilestoneRule[] {
  if (total < 2) return [];
  return rules.filter(
    (r) => !alreadyFired.has(r.key) && reached(r, aliveAfter, total) && !reached(r, aliveBefore, total),
  );
}
