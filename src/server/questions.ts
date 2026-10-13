import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { questions, users } from "@/db/schema";
import { audit } from "./audit";
import { AccessError, type Viewer } from "./auth/session";
import { queueEmail } from "./email";
import { GameError, staffEmails } from "./game";
import { notify } from "./notify";

export async function askQuestion(viewer: Viewer, text: string) {
  if (!viewer.season) throw new GameError("Ingen sesong");
  const question = text.trim();
  if (question.length < 5) throw new GameError("Spørsmålet er for kort");
  if (question.length > 2000) throw new GameError("Spørsmålet er for langt");
  await db.transaction(async (tx) => {
    await tx.insert(questions).values({ seasonId: viewer.season!.id, userId: viewer.user.id, question });
    const staffRows = await staffEmails(tx, viewer.season!.id);
    await notify(tx, staffRows.map((s) => ({ userId: s.userId, seasonId: viewer.season!.id, text: "Nytt spørsmål i innboksen", href: "/admin/sporsmal" })));
    await queueEmail(tx, "staff_question", staffRows.map((s) => s.email));
  });
}

export async function myQuestions(viewer: Viewer) {
  if (!viewer.season) return [];
  return db
    .select({ id: questions.id, question: questions.question, answer: questions.answer, answeredAt: questions.answeredAt, createdAt: questions.createdAt })
    .from(questions)
    .where(and(eq(questions.seasonId, viewer.season.id), eq(questions.userId, viewer.user.id)))
    .orderBy(desc(questions.createdAt));
}

export async function inbox(viewer: Viewer) {
  if (!viewer.season || !viewer.isStaff) throw new AccessError();
  return db
    .select({ q: questions, asker: users.name })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.userId))
    .where(eq(questions.seasonId, viewer.season.id))
    .orderBy(desc(questions.createdAt));
}

export async function answerQuestion(viewer: Viewer, id: string, answer: string) {
  if (!viewer.season || !viewer.isStaff) throw new AccessError();
  if (!answer.trim()) throw new GameError("Svaret er tomt");
  await db.transaction(async (tx) => {
    const [q] = await tx
      .update(questions)
      .set({ answer: answer.trim(), answeredBy: viewer.user.id, answeredAt: new Date() })
      .where(and(eq(questions.id, id), eq(questions.seasonId, viewer.season!.id)))
      .returning();
    if (!q) throw new GameError("Spørsmålet finnes ikke");
    const asker = await tx.query.users.findFirst({ where: eq(users.id, q.userId) });
    await notify(tx, [{ userId: q.userId, seasonId: q.seasonId, text: "Spillmesterne har svart på spørsmålet ditt", href: "/sporsmal" }]);
    await queueEmail(tx, "question_answered", [asker?.email], { sporsmal: q.question, svar: answer.trim() });
    await audit(tx, { seasonId: q.seasonId, actorUserId: viewer.user.id, action: "sporsmal.besvart", details: { id } });
  });
}

export async function publishQuestion(viewer: Viewer, id: string, publicQuestion: string, publicAnswer: string, published: boolean) {
  if (!viewer.season || !viewer.isStaff) throw new AccessError();
  if (published && (!publicQuestion.trim() || !publicAnswer.trim())) throw new GameError("Både spørsmål og svar må fylles ut");
  await db
    .update(questions)
    .set({ published, publicQuestion: publicQuestion.trim() || null, publicAnswer: publicAnswer.trim() || null })
    .where(and(eq(questions.id, id), eq(questions.seasonId, viewer.season.id)));
}

export async function faq(seasonId: string) {
  return db
    .select({ id: questions.id, question: questions.publicQuestion, answer: questions.publicAnswer })
    .from(questions)
    .where(and(eq(questions.seasonId, seasonId), eq(questions.published, true)))
    .orderBy(desc(questions.answeredAt));
}
