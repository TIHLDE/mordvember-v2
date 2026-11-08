import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { redirectToLogin } from "@/lib/guard";
import { getViewer } from "@/server/auth/session";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

import { Link } from "@tanstack/react-router";
import { Card, Empty, PageTitle } from "@/components/ui";

import { formatOslo } from "@/game/time";

import { MarkRead } from "./MarkRead";

const loadNotificationsPage = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = await getViewer();
  if (!viewer) return redirectToLogin();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, viewer.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  return { rows };
});

export const Route = createFileRoute("/(site)/varsler/")({
  loader: ({ location }) => loadNotificationsPage({ headers: { "x-mv-path": location.href } }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { rows } = Route.useLoaderData();
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
              <li
                key={n.id}
                className="flex items-start justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0"
              >
                <span className={n.readAt ? "text-zinc-400" : "font-medium text-white"}>
                  {n.href ? (
                    <Link to={n.href} className="hover:underline">
                      {n.text}
                    </Link>
                  ) : (
                    n.text
                  )}
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
