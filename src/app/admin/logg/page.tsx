import { Card, Empty, PageTitle } from "@/components/ui";
import { formatOslo } from "@/game/time";
import { guard } from "@/lib/guard";
import { auditEntries } from "@/server/admin";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const viewer = await guard("gamemaster");
  const rows = await auditEntries(viewer.season.id);
  return (
    <div className="space-y-6">
      <PageTitle sub="Alle adminhandlinger, inkludert hver visning av sirkelen.">Revisjonslogg</PageTitle>
      <Card>
        {rows.length === 0 ? (
          <Empty>Tom.</Empty>
        ) : (
          <ul className="space-y-1.5 font-mono text-xs leading-relaxed break-words">
            {rows.map((r) => (
              <li key={r.id} className="text-zinc-400">
                <span className="text-zinc-500">{formatOslo(r.createdAt)}</span> <span className="text-white">{r.actor ?? "system"}</span> {r.action}{" "}
                {Object.keys(r.details).length > 0 && <span className="text-zinc-600">{JSON.stringify(r.details)}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
