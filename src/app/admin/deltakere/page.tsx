import { asc, eq } from "drizzle-orm";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Button, Card, Empty, inputClass, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { players } from "@/db/schema";
import { guard } from "@/lib/guard";
import { usersWithoutPlayer } from "@/server/admin";
import { addPlayerAction, disqualifyAction, removePlayerAction } from "../actions";

export const dynamic = "force-dynamic";

const STATUS = { alive: ["Med", "green"], eliminated: ["Eliminert", "zinc"], disqualified: ["Diskvalifisert", "red"] } as const;

export default async function PlayersAdmin() {
  const viewer = await guard("staff");
  const rows = await db
    .select({ id: players.id, name: players.name, status: players.status, killCount: players.killCount, studyProgram: players.studyProgram, studyStartYear: players.studyStartYear })
    .from(players)
    .where(eq(players.seasonId, viewer.season.id))
    .orderBy(asc(players.name));
  const candidates = viewer.isGamemaster ? await usersWithoutPlayer(viewer.season.id) : [];
  return (
    <div className="space-y-6">
      <PageTitle sub={`${rows.length} påmeldt`}>Deltakere</PageTitle>
      <Card>
        {rows.length === 0 && <Empty>Ingen påmeldt ennå.</Empty>}
        <ul className="divide-y divide-white/5 text-sm">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{p.name}</span>
                  <Badge tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge>
                </p>
                <p className="mt-0.5 text-zinc-500">
                  {p.studyProgram ?? "Studie mangler"}
                  {p.studyStartYear ? ` · ${p.studyStartYear}` : ""} · <span className="tabular-nums">{p.killCount}</span> drap
                </p>
              </div>
              {p.status === "alive" && viewer.season.phase === "running" && (
                <ActionForm action={disqualifyAction} className="flex gap-2" confirm={`Diskvalifisere ${p.name}?`}>
                  <input type="hidden" name="playerId" value={p.id} />
                  <input name="reason" required aria-label="Begrunnelse" placeholder="Begrunnelse" className={`${inputClass} sm:w-44`} />
                  <Button type="submit" variant="danger-ghost">Diskvalifiser</Button>
                </ActionForm>
              )}
              {viewer.isGamemaster && viewer.season.phase !== "running" && viewer.season.phase !== "ended" && (
                <ActionForm action={removePlayerAction} confirm={`Fjerne ${p.name} fra sesongen?`}>
                  <input type="hidden" name="playerId" value={p.id} />
                  <Button type="submit" variant="ghost" size="sm">Fjern</Button>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {viewer.isGamemaster && (
        <Card title="Legg til deltaker">
          <p className="mb-4 text-sm text-zinc-400">
            Brukeren må ha logget inn i appen én gang. Under spillet legges nye deltakere til som ute, og du setter dem inn i sirkelen med nåde.
          </p>
          <ActionForm action={addPlayerAction} className="flex flex-wrap gap-2">
            <select name="userId" required aria-label="Bruker" className={`${inputClass} min-w-0 flex-1`}>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>
            <Button type="submit">Legg til</Button>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
