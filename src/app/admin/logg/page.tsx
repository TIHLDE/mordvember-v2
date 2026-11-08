import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Empty, PageTitle } from "@/components/ui";
import { formatOslo } from "@/game/time";

const loadAuditPage = createServerFn({ method: "GET" }).handler(async () => {
  const { guard } = await import("@/lib/guard");
  const { auditEntries } = await import("@/server/admin");
  const viewer = await guard("gamemaster");
  const rows = await auditEntries(viewer.season.id);
  return { rows: rows.map((row) => ({ ...row, details: JSON.stringify(row.details) })) };
});

export const Route = createFileRoute("/admin/logg/")({
  loader: ({ location }) => loadAuditPage({ headers: { "x-mv-path": location.href } }),
  component: AuditPage,
});

function AuditPage() {
  const { rows } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageTitle sub="Alle adminhandlinger, inkludert hver visning av sirkelen.">
        Revisjonslogg
      </PageTitle>
      <Card>
        {rows.length === 0 ? (
          <Empty>Tom.</Empty>
        ) : (
          <ul className="space-y-1.5 font-mono text-xs leading-relaxed break-words">
            {rows.map((r) => (
              <li key={r.id} className="text-zinc-400">
                <span className="text-zinc-500">{formatOslo(r.createdAt)}</span>{" "}
                <span className="text-white">{r.actor ?? "system"}</span> {r.action}{" "}
                {r.details !== "{}" && <span className="text-zinc-600">{r.details}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
