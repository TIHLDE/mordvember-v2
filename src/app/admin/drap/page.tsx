import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Button, Card, Empty, inputClass, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { kills, players } from "@/db/schema";
import { isOverdue } from "@/game/kills";
import { formatOslo } from "@/game/time";
import { guard } from "@/lib/guard";
import { approveKillAction, rejectKillAction, undoKillAction } from "../actions";

export const dynamic = "force-dynamic";

const killer = alias(players, "killer");
const victim = alias(players, "victim");

export default async function KillCases() {
  const viewer = await guard("staff");
  const rows = await db
    .select({ kill: kills, killer: killer.name, victim: victim.name })
    .from(kills)
    .innerJoin(killer, eq(killer.id, kills.killerId))
    .innerJoin(victim, eq(victim.id, kills.victimId))
    .where(and(eq(kills.seasonId, viewer.season.id), inArray(kills.status, ["pending", "escalated", "applied"])))
    .orderBy(desc(kills.reportedAt));
  const now = new Date();
  const open = rows.filter((r) => r.kill.status === "escalated" || isOverdue(r.kill, now));
  const waiting = rows.filter((r) => r.kill.status === "pending" && !isOverdue(r.kill, now));
  const applied = viewer.isGamemaster ? rows.filter((r) => r.kill.status === "applied") : [];

  return (
    <div className="space-y-4">
      <PageTitle sub="Saker som er bestridt, flagget som kollisjon eller ikke bekreftet innen 12 timer.">Drapssaker</PageTitle>
      <Card title="Til avgjørelse">
        {open.length === 0 ? (
          <Empty>Ingen saker.</Empty>
        ) : (
          <ul className="space-y-4">
            {open.map(({ kill, killer, victim }) => (
              <li key={kill.id} className="rounded-lg border border-white/10 p-4 text-sm">
                <p className="font-medium text-white">
                  {killer} → {victim}
                </p>
                <p className="text-zinc-400">
                  Drapstidspunkt {formatOslo(kill.killedAt)} · meldt av {kill.reportedBy === "killer" ? "morder" : "offer"} {formatOslo(kill.reportedAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {kill.status === "pending" && <Badge tone="amber">Ikke bekreftet innen 12 timer</Badge>}
                  {kill.escalationReasons.map((r) => (
                    <Badge key={r} tone="red">{r}</Badge>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <ActionForm action={approveKillAction} className="space-y-2" confirm="Godkjenne drapet? Sirkelen oppdateres.">
                    <input type="hidden" name="killId" value={kill.id} />
                    <input name="note" placeholder="Notat (valgfritt)" className={inputClass} />
                    <Button type="submit">Godkjenn drap</Button>
                  </ActionForm>
                  <ActionForm action={rejectKillAction} className="space-y-2" confirm="Avvise drapet?">
                    <input type="hidden" name="killId" value={kill.id} />
                    <input name="note" placeholder="Begrunnelse" className={inputClass} />
                    <Button type="submit" variant="ghost">Avvis</Button>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Venter på bekreftelse fra deltaker">
        {waiting.length === 0 ? (
          <Empty>Ingen.</Empty>
        ) : (
          <ul className="space-y-1 text-sm text-zinc-400">
            {waiting.map(({ kill }) => (
              <li key={kill.id}>Meldt {formatOslo(kill.reportedAt)}</li>
            ))}
          </ul>
        )}
      </Card>
      {viewer.isGamemaster && (
        <Card title="Gjennomførte drap (bare spillmestere)">
          {applied.length === 0 ? (
            <Empty>Ingen drap ennå.</Empty>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {applied.map(({ kill, killer, victim }) => (
                <li key={kill.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {killer} → {victim} <span className="text-zinc-500">{formatOslo(kill.killedAt)}</span>
                  </span>
                  <ActionForm action={undoKillAction} confirm="Angre drapet? Offeret settes tilbake i sirkelen.">
                    <input type="hidden" name="killId" value={kill.id} />
                    <Button type="submit" variant="ghost">Angre</Button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
