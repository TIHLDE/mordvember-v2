import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Empty, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { formatOslo } from "@/game/time";
import { getViewer } from "@/server/auth/session";
import { MarkRead } from "./MarkRead";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/varsler");
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, viewer.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>Varsler</PageTitle>
      <MarkRead hasUnread={rows.some((r) => !r.readAt)} />
      <Card>
        {rows.length === 0 ? (
          <Empty>Ingen varsler.</Empty>
        ) : (
          <ul className="divide-y divide-white/5">
            {rows.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                <span className={n.readAt ? "text-zinc-400" : "font-medium text-white"}>
                  {n.href ? <Link href={n.href} className="hover:underline">{n.text}</Link> : n.text}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">{formatOslo(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
