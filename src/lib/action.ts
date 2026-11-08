import "@tanstack/react-start/server-only";
import { getRequest } from "@tanstack/react-start/server";
import { BIO_FIELDS, composeBio } from "@/game/bio";
import { RingError } from "@/game/ring";
import { osloTime } from "@/game/time";
import { AccessError } from "@/server/auth/session";
import { deliverPendingEmails } from "@/server/email";
import { GameError } from "@/server/game";

export type ActionState = { ok?: string; error?: string; nonce?: string } | null;

export async function run(
  fn: () => Promise<string | void>,
  okMessage = "Lagret",
): Promise<ActionState> {
  try {
    const result = await fn();
    const request = getRequest();
    // Nitro keeps supported runtimes alive after the response. Cron retries the outbox otherwise.
    if ("waitUntil" in request && typeof request.waitUntil === "function") {
      request.waitUntil(
        deliverPendingEmails().catch((e) => console.error("E-postutsending feilet", e)),
      );
    }
    return { ok: result ?? okMessage, nonce: crypto.randomUUID() };
  } catch (error) {
    if (error instanceof GameError || error instanceof AccessError || error instanceof RingError) {
      return { error: error.message };
    }
    if (error instanceof Error && /større enn|må være JPG/.test(error.message))
      return { error: error.message };
    console.error(error);
    return { error: "Noe gikk galt. Prøv igjen." };
  }
}

export function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function bioFrom(form: FormData) {
  return composeBio(
    Object.fromEntries(BIO_FIELDS.map(({ key }) => [key, text(form, `bio_${key}`)])),
  );
}

export function osloInput(value: string): Date {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match) throw new GameError("Ugyldig tidspunkt");
  return osloTime(match[1] as string, match[2] as string);
}
