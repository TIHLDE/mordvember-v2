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
      // One notice and one e-mail to each staff member per overdue case.
      const bySeason = Map.groupBy(overdue, (kill) => kill.seasonId);
      await Promise.all(
        [...bySeason].map(async ([seasonId, cases]) => {
          const staff = await staffEmails(tx, seasonId);
          const text = "En drapssak er ikke bekreftet innen 12 timer.";
          await notify(tx, cases.flatMap(() => staff.map((s) => ({ userId: s.userId, seasonId, text, href: "/admin/drap" }))));
          await Promise.all(cases.map(() => queueEmail(tx, "staff_case", staff.map((s) => s.email), { grunn: "Ikke bekreftet innen 12 timer" })));
        }),
      );
      return overdue.length;
    });
    if (escalated) done.push(`eskalert:${escalated}`);
  });

  await step("ukejobber", async () => {
    // Thursday 16:00 to Friday 16:00 is warning time, and the Friday list is due after that.
    const p = osloParts(now);
    const thursdayDue = (p.isoWeekday === 4 && p.hour >= 16) || (p.isoWeekday === 5 && p.hour < 16);
    const fridayDue = (p.isoWeekday === 5 && p.hour >= 16) || p.isoWeekday >= 6;
    const job = thursdayDue ? { name: "torsdag", run: sendThursdayWarnings } : fridayDue ? { name: "fredag", run: buildFridayList } : null;
    if (!job) return;
    const weekStart = weekStartOf(now);
    const running = await db.select().from(seasons).where(eq(seasons.phase, "running"));
    await Promise.all(
      running.map((season) =>
        step(`${job.name}:${season.id}`, async () => {
          if (await runOnce(`${job.name}:${season.id}:${weekStart}`, () => job.run(season, weekStart, now))) done.push(job.name);
        }),
      ),
    );
  });

  await step("e-post", async () => {
    const notSent = await deliverPendingEmails();
    await db.delete(emailOutbox).where(and(eq(emailOutbox.status, "sent"), lte(emailOutbox.sentAt, new Date(now.getTime() - 14 * 86400_000))));
    if (notSent) throw new Error(`${notSent} e-poster ble ikke sendt`);
  });
  return { done, failed };
}
