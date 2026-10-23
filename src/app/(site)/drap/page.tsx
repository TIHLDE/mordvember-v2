import { and, desc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { DateTimePicker } from "@/components/DateTimePicker";
import { Badge, Button, Card, Empty, Field, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { kills, players } from "@/db/schema";
import { formatOslo } from "@/game/time";
import { osloInputValue } from "@/lib/action";
import { redirectToLogin } from "@/lib/guard";
import { getViewer } from "@/server/auth/session";
import { confirmKillAction, disputeKillAction, reportKillAction } from "../actions";

export const dynamic = "force-dynamic";

const killer = alias(players, "killer");
const victim = alias(players, "victim");

export default async function KillsPage() {
  const viewer = await getViewer();
  if (!viewer) return redirectToLogin();
  if (!viewer.player || !viewer.season) redirect("/");
  const me = viewer.player.id;
  const mine = await db
    .select({ kill: kills, killerName: killer.name, victimName: victim.name })
    .from(kills)
    .innerJoin(killer, eq(killer.id, kills.killerId))
    .innerJoin(victim, eq(victim.id, kills.victimId))
    .where(and(eq(kills.seasonId, viewer.season.id), or(eq(kills.killerId, me), eq(kills.victimId, me)), inArray(kills.status, ["pending", "escalated", "applied", "rejected"])))
    .orderBy(desc(kills.reportedAt));
  const open = mine.filter((m) => m.kill.status === "pending" || m.kill.status === "escalated");
  const history = mine.filter((m) => m.kill.status === "applied" || m.kill.status === "rejected");
  const running = viewer.season.phase === "running" && viewer.player.status === "alive";
  const now = osloInputValue(new Date());

  return (
    <div className="space-y-6">
      <PageTitle sub="Ingenting endres før drapet er bekreftet av begge eller godkjent av spillmesterne.">Drap</PageTitle>

      {open.length > 0 && (
        <Card title="Åpne saker">
          <ul className="divide-y divide-white/5">
            {open.map(({ kill, killerName, victimName }) => {
              const iAmVictim = kill.victimId === me;
              const iConfirm = (kill.reportedBy === "killer" ? kill.victimId : kill.killerId) === me;
              return (
                <li key={kill.id} className="py-4 first:pt-0 last:pb-0">
                  <p className="text-sm">
                    {iAmVictim
                      ? kill.reportedBy === "killer"
                        ? `${killerName} har meldt at hen tok deg ${formatOslo(kill.killedAt)}.`
                        : `Du meldte at du ble tatt ${formatOslo(kill.killedAt)}.`
                      : kill.reportedBy === "victim"
                        ? `${victimName} har meldt at du tok hen ${formatOslo(kill.killedAt)}.`
                        : `Du meldte at du tok ${victimName} ${formatOslo(kill.killedAt)}.`}
                  </p>
                  <p className="mt-2">
                    {kill.status === "escalated" ? <Badge tone="amber">Hos spillmesterne</Badge> : iConfirm ? <Badge tone="red">Venter på deg</Badge> : <Badge>Venter på den andre</Badge>}
                  </p>
                  {kill.status === "pending" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {iConfirm && (
                        <ActionForm action={confirmKillAction} confirm="Bekrefte drapet?">
                          <input type="hidden" name="killId" value={kill.id} />
                          <Button type="submit">Bekreft</Button>
                        </ActionForm>
                      )}
                      <ActionForm action={disputeKillAction} confirm="Sende saken til spillmesterne?">
                        <input type="hidden" name="killId" value={kill.id} />
                        <Button type="submit" variant="ghost">Dette stemmer ikke</Button>
                      </ActionForm>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {running && (
        <Card title="Jeg har tatt offeret mitt">
          <ActionForm action={reportKillAction} className="space-y-4" confirm="Melde drap på offeret ditt?">
            <Field label="Når skjedde det?">
              <DateTimePicker name="killedAt" defaultValue={now} max={now} required />
            </Field>
            <Button type="submit">Meld drap</Button>
          </ActionForm>
        </Card>
      )}

      <Card title="Min historikk">
        {history.length === 0 ? (
          <Empty>Ingen drap ennå.</Empty>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {history.map(({ kill, victimName }) => (
              <li key={kill.id} className="flex flex-wrap items-center gap-2 py-2 first:pt-0">
                <span>{kill.victimId === me ? `Du ble tatt ${formatOslo(kill.killedAt)}` : `Du tok ${victimName} ${formatOslo(kill.killedAt)}`}</span>
                {kill.status === "rejected" && <Badge>Avvist</Badge>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 border-t border-white/5 pt-4 text-sm text-zinc-400">Drap totalt: <span className="text-white tabular-nums">{viewer.player.killCount}</span></p>
      </Card>
    </div>
  );
}
