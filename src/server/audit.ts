import "@tanstack/react-start/server-only";
import { db, type Tx } from "@/db";
import { auditLog } from "@/db/schema";

export async function audit(
  tx: Tx | typeof db,
  entry: {
    seasonId: string | null;
    actorUserId: string | null;
    action: string;
    details?: Record<string, unknown>;
  },
) {
  await tx.insert(auditLog).values({ ...entry, details: entry.details ?? {} });
}
