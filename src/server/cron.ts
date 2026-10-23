import "server-only";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox, kills, seasons } from "@/db/schema";
import { CONFIRM_TIMEOUT_MS } from "@/game/kills";
import { osloParts, weekStartOf } from "@/game/time";
import { closeForgottenSessions } from "./attendance";
import { deliverPendingEmails, queueEmail } from "./email";
import { staffEmails } from "./game";
import { notify } from "./notify";
import { buildFridayList, claimJob, releaseJob, sendThursdayWarnings } from "./weekly";

async function runOnce(key: string, job: () => Promise<unknown>): Promise<boolean> {
  if (!(await claimJob(key))) return false;
  try {
    await job();
    return true;
  } catch (error) {
    // Kravet frigis så neste cron-kjøring prøver igjen.
    await releaseJob(key);
    throw error;
  }
}

export async function runCron(now = new Date()) {
  const done: string[] = [];
  const failed: string[] = [];
  const step = async (name: string, job: () => Promise<unknown>) => {
    try {
      await job();
    } catch (error) {
      console.error(`Cron-steget ${name} feilet`, error);
      failed.push(name);
    }
  };

  await step("innsjekk", () => closeForgottenSessions(now));
  await step("eskalering", async () => {
    const escalated = await db.transaction(async (tx) => {
      const overdue = await tx
        .update(kills)
        .set({ status: "escalated", escalationReasons: ["Ikke bekreftet innen 12 timer"] })
        .where(and(eq(kills.status, "pending"), lte(kills.reportedAt, new Date(now.getTime() - CONFIRM_TIMEOUT_MS))))
        .returning();
      for (const kill of overdue) {
        const staff = await staffEmails(tx, kill.seasonId);
        await notify(tx, staff.map((s) => ({ userId: s.userId, seasonId: kill.seasonId, text: "En drapssak er ikke bekreftet innen 12 timer.", href: "/admin/drap" })));
        await queueEmail(tx, "staff_case", staff.map((s) => s.email), { grunn: "Ikke bekreftet innen 12 timer" });
      }
      return overdue.length;
    });
    if (escalated) done.push(`eskalert:${escalated}`);
  });

  await step("ukejobber", async () => {
    const running = await db.select().from(seasons).where(eq(seasons.phase, "running"));
    const p = osloParts(now);
    for (const season of running) {
      const weekStart = weekStartOf(now);
      const thursdayDue = (p.isoWeekday === 4 && p.hour >= 16) || (p.isoWeekday === 5 && p.hour < 16);
      if (thursdayDue) {
        await step(`torsdag:${season.id}`, async () => {
          if (await runOnce(`torsdag:${season.id}:${weekStart}`, () => sendThursdayWarnings(season, weekStart, now))) done.push("torsdag");
        });
      }
      const fridayDue = (p.isoWeekday === 5 && p.hour >= 16) || p.isoWeekday >= 6;
      if (fridayDue) {
        await step(`fredag:${season.id}`, async () => {
          if (await runOnce(`fredag:${season.id}:${weekStart}`, () => buildFridayList(season, weekStart, now))) done.push("fredag");
        });
      }
    }
  });

  await step("e-post", async () => {
    const notSent = await deliverPendingEmails();
    await db.delete(emailOutbox).where(and(eq(emailOutbox.status, "sent"), lte(emailOutbox.sentAt, new Date(now.getTime() - 14 * 86400_000))));
    if (notSent) throw new Error(`${notSent} e-poster ble ikke sendt`);
  });
  return { done, failed };
}
