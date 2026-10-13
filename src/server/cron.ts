import "server-only";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox, kills, milestoneEvents, players, seasons, users } from "@/db/schema";
import { CONFIRM_TIMEOUT_MS } from "@/game/kills";
import { addDays, osloParts, weekStartOf } from "@/game/time";
import { closeForgottenSessions } from "./attendance";
import { deliverPendingEmails, queueEmail } from "./email";
import { staffEmails } from "./game";
import { notify } from "./notify";
import { closeExpiredSignups } from "./season";
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
  await closeExpiredSignups(now);
  await closeForgottenSessions(now);

  const overdue = await db
    .update(kills)
    .set({ status: "escalated", escalationReasons: ["Ikke bekreftet innen 12 timer"] })
    .where(and(eq(kills.status, "pending"), lte(kills.reportedAt, new Date(now.getTime() - CONFIRM_TIMEOUT_MS))))
    .returning();
  for (const kill of overdue) {
    const staff = await staffEmails(db, kill.seasonId);
    await notify(db, staff.map((s) => ({ userId: s.userId, seasonId: kill.seasonId, text: "En drapssak er ikke bekreftet innen 12 timer.", href: "/admin/drap" })));
    await queueEmail(db, "staff_case", staff.map((s) => s.email), { grunn: "Ikke bekreftet innen 12 timer" });
  }
  if (overdue.length) done.push(`eskalert:${overdue.length}`);

  const running = await db.select().from(seasons).where(eq(seasons.phase, "running"));
  const p = osloParts(now);
  for (const season of running) {
    const weekStart = weekStartOf(now);
    const thursdayDue = (p.isoWeekday === 4 && p.hour >= 16) || (p.isoWeekday === 5 && p.hour < 16);
    if (thursdayDue && (await runOnce(`torsdag:${season.id}:${weekStart}`, () => sendThursdayWarnings(season, weekStart, now)))) {
      done.push("torsdag");
    }
    const fridayDue = (p.isoWeekday === 5 && p.hour >= 16) || p.isoWeekday >= 6;
    if (fridayDue && (await runOnce(`fredag:${season.id}:${weekStart}`, () => buildFridayList(season, weekStart, now)))) {
      done.push("fredag");
    }
  }

  const dueMilestones = await db
    .select()
    .from(milestoneEvents)
    .where(and(lte(milestoneEvents.showAt, now), isNull(milestoneEvents.emailedAt), eq(milestoneEvents.sendEmail, true)));
  for (const m of dueMilestones) {
    const sent = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(milestoneEvents)
        .set({ emailedAt: now })
        .where(and(eq(milestoneEvents.id, m.id), isNull(milestoneEvents.emailedAt)))
        .returning();
      if (!claimed) return false;
      const recipients = await tx
        .select({ email: users.email, status: players.status })
        .from(players)
        .innerJoin(users, eq(users.id, players.userId))
        .where(eq(players.seasonId, m.seasonId));
      const alive = recipients.filter((r) => r.status === "alive").length;
      await queueEmail(tx, "milestone", recipients.map((r) => r.email), { milepael: m.label, igjen: alive });
      return true;
    });
    if (sent) done.push(`milepael:${m.key}`);
  }

  const ended = await db
    .select()
    .from(seasons)
    .where(and(eq(seasons.phase, "ended"), isNull(seasons.dataDeletedAt), isNull(seasons.deletionReminderSentAt)));
  for (const season of ended) {
    if (!season.endedAt || addDays(season.endedAt.toISOString().slice(0, 10), 30) > now.toISOString().slice(0, 10)) continue;
    const sent = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(seasons)
        .set({ deletionReminderSentAt: now })
        .where(and(eq(seasons.id, season.id), isNull(seasons.deletionReminderSentAt)))
        .returning();
      if (!claimed) return false;
      const staff = await staffEmails(tx, season.id);
      await notify(tx, staff.map((s) => ({ userId: s.userId, seasonId: season.id, text: `Husk å slette sesongdata for ${season.name}`, href: "/admin/sesong" })));
      await queueEmail(tx, "deletion_reminder", staff.map((s) => s.email), { sesong: season.name });
      return true;
    });
    if (sent) done.push("slettepaminnelse");
  }

  await deliverPendingEmails();
  await db.delete(emailOutbox).where(and(eq(emailOutbox.status, "sent"), lte(emailOutbox.sentAt, new Date(now.getTime() - 14 * 86400_000))));
  return done;
}
