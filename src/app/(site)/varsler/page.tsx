import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

import { Link } from "@tanstack/react-router";
import { Card, Empty, PageTitle } from "@/components/ui";


import { formatOslo } from "@/game/time";


import { MarkRead } from "./MarkRead";
export const dynamic = "force-dynamic";
function NotificationsPage() {
 const { viewer, rows } = Route.useLoaderData();
return (<div className="mx-auto max-w-2xl">
      <PageTitle>Varsler</PageTitle>
      <MarkRead hasUnread={rows.some((r) => !r.readAt)}/>
      <Card>
        {rows.length === 0 ? (<Empty>Ingen varsler.</Empty>) : (<ul className="divide-y divide-white/5">
            {rows.map((n) => (<li key={n.id} className="flex items-start justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0">
                <span className={n.readAt ? "text-zinc-400" : "font-medium text-white"}>
                  {n.href ? <Link to={n.href} className="hover:underline">{n.text}</Link> : n.text}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">{formatOslo(n.createdAt)}</span>
              </li>))}
          </ul>)}
      </Card>
    </div>);
}

export const Route = createFileRoute("/(site)/varsler/")({ loader: () => loadNotificationsPage(), component: NotificationsPage });

const loadNotificationsPage = createServerFn({ method: "GET" }).handler(async () => {
const { desc, eq } = await import("drizzle-orm");
const { db } = await import("@/db");
const { notifications } = await import("@/db/schema");
const { redirectToLogin } = await import("@/lib/guard");
const { getViewer } = await import("@/server/auth/session");
const viewer = await getViewer();
if (!viewer)
        return redirectToLogin();
const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, viewer.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(100);
return { viewer, rows };
});
