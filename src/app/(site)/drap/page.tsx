import { and, desc, eq, inArray, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Button, Card, Empty, Field, inputClass, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { kills, players } from "@/db/schema";
import { formatOslo } from "@/game/time";
import { osloInputValue } from "@/lib/action";
import { getViewer } from "@/server/auth/session";
import { confirmKillAction, disputeKillAction, reportKillAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function KillsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/drap");
  if (!viewer.player || !viewer.season) redirect("/");
  const me = viewer.player.id;
  const mine = await db
    .select({ kill: kills, victimName: players.name })
    .from(kills)
    .innerJoin(players, eq(players.id, kills.victimId))
    .where(and(eq(kills.seasonId, viewer.season.id), or(eq(kills.killerId, me), eq(kills.victimId, me)), inArray(kills.status, ["pending", "escalated", "applied", "rejected"])))
    .orderBy(desc(kills.reportedAt));
  const open = mine.filter((m) => m.kill.status === "pending" || m.kill.status === "escalated");
  const history = mine.filter((m) => m.kill.status === "applied" || m.kill.status === "rejected");
  const running = viewer.season.phase === "running" && viewer.player.status === "alive";
  const now = osloInputValue(new Date());

  return (
    <div className="space-y-6">
      <PageTitle sub="Ingenting endres før drapet er bekreftet av begge eller godkjent av arrangørene.">Drap</PageTitle>

      {open.length > 0 && (
        <Card title="Åpne saker">
          <ul className="space-y-4">
            {open.map(({ kill, victimName }) => {
              const iAmVictim = kill.victimId === me;
              const iConfirm = (kill.reportedBy === "killer" ? kill.victimId : kill.killerId) === me;
              return (
                <li key={kill.id} className="rounded-lg border border-white/10 p-4">
                  <p className="text-sm">
                    {iAmVictim
                      ? kill.reportedBy === "killer"
                        ? `Noen har meldt at de tok deg ${formatOslo(kill.killedAt)}.`
                        : `Du meldte at du ble tatt ${formatOslo(kill.killedAt)}.`
                      : kill.reportedBy === "victim"
                        ? `${victimName} har meldt at du tok hen ${formatOslo(kill.killedAt)}.`
                        : `Du meldte at du tok ${victimName} ${formatOslo(kill.killedAt)}.`}
                  </p>
                  <p className="mt-1">
                    {kill.status === "escalated" ? <Badge tone="amber">Hos arrangørene</Badge> : iConfirm ? <Badge tone="red">Venter på deg</Badge> : <Badge>Venter på den andre</Badge>}
                  </p>
                  {kill.status === "pending" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {iConfirm && (
                        <ActionForm action={confirmKillAction} confirm="Bekrefte drapet?">
                          <input type="hidden" name="killId" value={kill.id} />
                          <Button type="submit">Bekreft</Button>
                        </ActionForm>
                      )}
                      <ActionForm action={disputeKillAction} confirm="Sende saken til arrangørene?">
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
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Jeg har tatt offeret mitt">
            <ActionForm action={reportKillAction} className="space-y-3" confirm="Melde drap på offeret ditt?">
              <input type="hidden" name="role" value="killer" />
              <Field label="Når skjedde det?">
                <input type="datetime-local" name="killedAt" defaultValue={now} max={now} required className={inputClass} />
              </Field>
              <Button type="submit">Meld drap</Button>
            </ActionForm>
          </Card>
          <Card title="Jeg er tatt">
            <ActionForm action={reportKillAction} className="space-y-3" confirm="Melde at du er tatt?">
              <input type="hidden" name="role" value="victim" />
              <Field label="Når skjedde det?">
                <input type="datetime-local" name="killedAt" defaultValue={now} max={now} required className={inputClass} />
              </Field>
              <Button type="submit" variant="ghost">Meld at jeg er tatt</Button>
            </ActionForm>
          </Card>
        </div>
      )}

      <Card title="Min historikk">
        {history.length === 0 ? (
          <Empty>Ingen drap ennå.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map(({ kill, victimName }) => (
              <li key={kill.id} className="flex flex-wrap items-center gap-2">
                <span>{kill.victimId === me ? `Du ble tatt ${formatOslo(kill.killedAt)}` : `Du tok ${victimName} ${formatOslo(kill.killedAt)}`}</span>
                {kill.status === "rejected" && <Badge>Avvist</Badge>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-zinc-400">Drap totalt: {viewer.player.killCount}</p>
      </Card>
    </div>
  );
}
