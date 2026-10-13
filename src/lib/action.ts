import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { RingError } from "@/game/ring";
import { osloParts, osloTime } from "@/game/time";
import { AccessError } from "@/server/auth/session";
import { deliverPendingEmails } from "@/server/email";
import { GameError } from "@/server/game";

export type ActionState = { ok?: string; error?: string; nonce?: number } | null;

export async function run(fn: () => Promise<string | void>, okMessage = "Lagret"): Promise<ActionState> {
  try {
    const result = await fn();
    revalidatePath("/", "layout");
    after(() => deliverPendingEmails().catch((e) => console.error("E-postutsending feilet", e)));
    return { ok: result ?? okMessage, nonce: Math.random() };
  } catch (error) {
    if (error instanceof GameError || error instanceof AccessError || error instanceof RingError) {
      return { error: error.message };
    }
    if (error instanceof Error && /større enn|må være JPG/.test(error.message)) return { error: error.message };
    console.error(error);
    return { error: "Noe gikk galt. Prøv igjen." };
  }
}

export function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function osloInput(value: string): Date {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match) throw new GameError("Ugyldig tidspunkt");
  return osloTime(match[1] as string, match[2] as string);
}

export function osloInputValue(at: Date): string {
  const p = osloParts(at);
  return `${p.date}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
