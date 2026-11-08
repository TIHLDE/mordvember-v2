import { osloParts } from "@/game/time";

export function osloInputValue(at: Date): string {
  const p = osloParts(at);
  return `${p.date}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
