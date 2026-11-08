import "@tanstack/react-start/server-only";
import { eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { notifications, players, users } from "@/db/schema";

/** The user id and e-mail address behind each player, for notifying them. */
export async function playerRecipients(tx: Tx, playerIds: readonly string[]) {
  if (!playerIds.length) return [];
  return tx
    .select({ userId: users.id, email: users.email })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(inArray(players.id, [...playerIds]));
}

export async function notify(
  tx: Tx | typeof db,
  items: { userId: string; seasonId: string | null; text: string; href?: string }[],
) {
  if (!items.length) return;
  await tx.insert(notifications).values(items.map((i) => ({ ...i, href: i.href ?? null })));
}
