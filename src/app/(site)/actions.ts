"use server";

import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { BIO_FIELDS, composeBio } from "@/game/bio";
import { type ActionState, osloInput, run, text } from "@/lib/action";
import { PENDING_SCAN_COOKIE, readPendingScan, SCAN_RESULT_COOKIE, toggleCheckin } from "@/server/attendance";
import { requirePlayer, requireSeason, requireViewer } from "@/server/auth/session";
import { myTarget } from "@/server/circle";
import { confirmKill, disputeKill, GameError, reportKill } from "@/server/game";
import {
  deleteOwnImage,
  setBio,
  setImage,
  signUp,
  chooseDefaultImage,
  withdraw,
} from "@/server/players";
import { askQuestion } from "@/server/questions";

function bioFrom(form: FormData) {
  return composeBio(Object.fromEntries(BIO_FIELDS.map(({ key }) => [key, text(form, `bio_${key}`)])));
}

export async function signUpAction(_: ActionState, form: FormData) {
  return run(async () => {
    const viewer = await requireSeason();
    const image = form.get("image");
    await signUp(viewer, { consent: form.get("consent") === "on", image: image instanceof File ? image : null, bio: bioFrom(form) });
    return "Du er påmeldt!";
  });
}

export async function withdrawAction(_: ActionState) {
  return run(async () => {
    await withdraw(await requirePlayer());
    return "Du er meldt av";
  });
}

export async function uploadImageAction(_: ActionState, form: FormData) {
  return run(async () => {
    const image = form.get("image");
    if (!(image instanceof File) || image.size === 0) throw new GameError("Velg et bilde");
    await setImage(await requirePlayer(), image);
    return "Bildet er lastet opp";
  });
}

export async function defaultImageAction(_: ActionState) {
  return run(async () => {
    await chooseDefaultImage(await requirePlayer());
    return "Du bruker profilbildet fra TIHLDE";
  });
}

export async function deleteImageAction(_: ActionState) {
  return run(async () => {
    await deleteOwnImage(await requirePlayer());
    return "Bildet er slettet";
  });
}

export async function bioAction(_: ActionState, form: FormData) {
  return run(async () => {
    await setBio(await requirePlayer(), bioFrom(form));
    return "Beskrivelsen er lagret";
  });
}

export async function revealTargetAction(): Promise<{ name: string; image: string; bio: string | null } | null> {
  const viewer = await requirePlayer();
  const target = await myTarget(viewer);
  if (!target) return null;
  return { name: target.name, image: `/api/bilde/${target.id}`, bio: target.bio };
}

export async function reportKillAction(_: ActionState, form: FormData) {
  return run(async () => {
    const when = osloInput(text(form, "killedAt"));
    await reportKill(await requirePlayer(), "killer", when);
    return "Drapet er meldt. Offeret ditt må bekrefte.";
  });
}

export async function confirmKillAction(_: ActionState, form: FormData) {
  return run(async () => {
    await confirmKill(await requirePlayer(), text(form, "killId"));
    return "Bekreftet";
  });
}

export async function disputeKillAction(_: ActionState, form: FormData) {
  return run(async () => {
    await disputeKill(await requirePlayer(), text(form, "killId"));
    return "Saken er sendt til spillmesterne";
  });
}

export async function completeScanAction(intent: "in" | "out", position: { lat: number; lng: number } | null): Promise<ActionState> {
  return run(async () => {
    const viewer = await requirePlayer();
    const jar = await cookies();
    if (!readPendingScan(jar.get(PENDING_SCAN_COOKIE)?.value, viewer.season.id)) {
      throw new GameError("QR-koden er utløpt. Skann på nytt.");
    }
    const valid =
      position && Number.isFinite(position.lat) && Number.isFinite(position.lng) && Math.abs(position.lat) <= 90 && Math.abs(position.lng) <= 180
        ? position
        : null;
    const result = await toggleCheckin(viewer, valid, intent === "out" ? "out" : "in");
    jar.delete(PENDING_SCAN_COOKIE);
    jar.set(SCAN_RESULT_COOKIE, result.kind, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/sjekkinn",
      maxAge: 60,
    });
    return { in: "Du er sjekket inn", out: "Du er sjekket ut", forgotten: "Økta er lukket" }[result.kind];
  });
}

export async function askAction(_: ActionState, form: FormData) {
  return run(async () => {
    await askQuestion(await requireSeason(), text(form, "question"));
    return "Spørsmålet er sendt";
  });
}

export async function markNotificationsReadAction() {
  const viewer = await requireViewer();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, viewer.user.id), isNull(notifications.readAt)));
}
