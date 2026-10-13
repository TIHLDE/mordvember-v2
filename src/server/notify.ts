import "server-only";
import { db, type Tx } from "@/db";
import { notifications } from "@/db/schema";

export async function notify(
  tx: Tx | typeof db,
  items: { userId: string; seasonId: string | null; text: string; href?: string }[],
) {
  if (!items.length) return;
  await tx.insert(notifications).values(items.map((i) => ({ ...i, href: i.href ?? null })));
}
