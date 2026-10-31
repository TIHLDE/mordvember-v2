import "server-only";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox, kills, seasons } from "@/db/schema";
import { CONFIRM_TIMEOUT_MS } from "@/game/kills";
import { osloParts, weekStartOf } from "@/game/time";
import { closeForgottenSessions } from "./attendance";
import type { Season } from "./auth/session";
import { deliverPendingEmails, queueEmail } from "./email";
import { staffEmails } from "./game";
import { notify } from "./notify";
import { buildFridayListOnce, claimJob, releaseJob, sendThursdayWarnings } from "./weekly";

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
      // Grouped by hand: Map.groupBy needs Node 21, and Next 16 still runs on Node 20.
      const bySeason = new Map<string, typeof overdue>();
      for (const kill of overdue) bySeason.set(kill.seasonId, [...(bySeason.get(kill.seasonId) ?? []), kill]);
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
    const weekStart = weekStartOf(now);
    const job = thursdayDue
      ? { name: "torsdag", run: (season: Season) => runOnce(`torsdag:${season.id}:${weekStart}`, () => sendThursdayWarnings(season, weekStart, now)) }
      : fridayDue
        ? { name: "fredag", run: (season: Season) => buildFridayListOnce(season, weekStart, now) }
        : null;
    if (!job) return;
    const running = await db.select().from(seasons).where(eq(seasons.phase, "running"));
    await Promise.all(
      running.map((season) =>
        step(`${job.name}:${season.id}`, async () => {
          if (await job.run(season)) done.push(job.name);
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
