import { asc, eq } from "drizzle-orm";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Button, Card, inputClass, PageTitle } from "@/components/ui";
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
    <div className="space-y-4">
      <PageTitle sub={`${rows.length} påmeldt`}>Deltakere</PageTitle>
      <Card>
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1">Navn</th>
              <th>Studie</th>
              <th>Status</th>
              <th>Drap</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="py-2 text-white">{p.name}</td>
                <td className="text-zinc-400">
                  {p.studyProgram ?? "–"} {p.studyStartYear ?? ""}
                </td>
                <td>
                  <Badge tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge>
                </td>
                <td>{p.killCount}</td>
                <td className="space-y-1 py-2">
                  {p.status === "alive" && viewer.season.phase === "running" && (
                    <ActionForm action={disqualifyAction} className="flex gap-1" confirm={`Diskvalifisere ${p.name}?`}>
                      <input type="hidden" name="playerId" value={p.id} />
                      <input name="reason" required placeholder="Begrunnelse" className={`${inputClass} w-40`} />
                      <Button type="submit" variant="danger">Diskvalifiser</Button>
                    </ActionForm>
                  )}
                  {viewer.isGamemaster && viewer.season.phase !== "running" && viewer.season.phase !== "ended" && (
                    <ActionForm action={removePlayerAction} confirm={`Fjerne ${p.name} fra sesongen?`}>
                      <input type="hidden" name="playerId" value={p.id} />
                      <Button type="submit" variant="ghost">Fjern</Button>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {viewer.isGamemaster && (
        <Card title="Legg til deltaker">
          <p className="mb-2 text-sm text-zinc-400">
            Brukeren må ha logget inn i appen én gang. Under spillet legges nye deltakere til som ute, og du setter dem inn i sirkelen med nåde.
          </p>
          <ActionForm action={addPlayerAction} className="flex gap-2">
            <select name="userId" required className={`${inputClass} w-auto`}>
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
