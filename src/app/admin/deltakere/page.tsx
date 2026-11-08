import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

import { ActionForm } from "@/components/ActionForm";
import { inputClass } from "@/components/styles";
import { Badge, Button, Card, Empty, PageTitle } from "@/components/ui";


import { BIO_FIELDS, parseBio } from "@/game/bio";



import { addPlayerAction } from "../actions";
import { imageStatus, STATUS } from "./status";
function PlayersAdmin() {
 const { viewer, running, list, present, rows, pending, rest, waiting, noBio, candidates } = Route.useLoaderData();
return (<div className="space-y-6">
      <PageTitle sub={`${rows.length} påmeldt${waiting ? ` · ${waiting} bilder venter på godkjenning` : ""}${noBio ? ` · ${noBio} mangler utseende` : ""}. Trykk på en deltaker for å se bildet og gjøre endringer.`}>
        Deltakere
      </PageTitle>
      {pending.length > 0 && (<Card title={`Venter på godkjenning (${pending.length})`}>
          <PlayerList rows={pending}/>
        </Card>)}
      <Card title={pending.length > 0 ? `Alle andre (${rest.length})` : undefined}>
        {rows.length === 0 && <Empty>Ingen påmeldt ennå.</Empty>}
        <PlayerList rows={rest}/>
      </Card>
      {viewer.isGamemaster && (<Card title="Legg til deltaker">
          <p className="mb-4 text-sm text-zinc-400">
            Brukeren må ha logget inn i appen én gang. Under spillet legges nye deltakere til som ute, og du setter dem inn i sirkelen med nåde.
          </p>
          <ActionForm action={addPlayerAction} className="flex flex-wrap gap-2">
            <select name="userId" required aria-label="Bruker" className={`${inputClass} min-w-0 flex-1`}>
              {candidates.map((u) => (<option key={u.id} value={u.id}>
                  {u.name} ({u.username})
                </option>))}
            </select>
            <Button type="submit">Legg til</Button>
          </ActionForm>
        </Card>)}
    </div>);
}
type PlayerRow = {
    id: string;
    name: string;
    status: keyof typeof STATUS;
    killCount: number;
    studyProgram: string | null;
    studyStartYear: number | null;
    imageKey: string | null;
    imageApprovedAt: Date | null;
    imageRejectedReason: string | null;
    imageDeleted: boolean;
    bio: string | null;
    checkedIn: boolean | null;
};
function bioFilled(bio: string | null) {
    return Object.values(parseBio(bio)).filter(Boolean).length;
}
function PlayerList({ rows }: {
    rows: PlayerRow[];
}) {
    return (<ul className="-mx-2 divide-y divide-white/5 text-sm">
      {rows.map((p) => {
            const image = imageStatus(p);
            const filled = bioFilled(p.bio);
            return (<li key={p.id}>
            <Link to="/admin/deltakere/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-white/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/bilde/${p.id}?v=${p.imageKey ?? "standard"}`} alt="" loading="lazy" className="size-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"/>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{p.name}</span>
                  <Badge tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge>
                  {p.checkedIn !== null && <Badge tone={p.checkedIn ? "green" : "zinc"}>{p.checkedIn ? "Sjekket inn" : "Ikke sjekket inn"}</Badge>}
                  {image && image.tone !== "green" && <Badge tone={image.tone}>{image.label}</Badge>}
                  {filled === 0 ? (<Badge tone="amber">Utseende mangler</Badge>) : filled < BIO_FIELDS.length ? (<Badge>Utseende {filled}/{BIO_FIELDS.length}</Badge>) : null}
                </p>
                <p className="mt-0.5 truncate text-zinc-500">
                  {p.studyProgram ?? "Studie mangler"}
                  {p.studyStartYear ? ` · ${p.studyStartYear}` : ""} · <span className="tabular-nums">{p.killCount}</span> drap
                </p>
              </div>
              <span aria-hidden className="text-zinc-600">›</span>
            </Link>
          </li>);
        })}
    </ul>);
}

export const Route = createFileRoute("/admin/deltakere/")({ loader: ({ location }) => loadPlayersAdmin({ headers: { "x-mv-path": location.href } }), component: PlayersAdmin });

const loadPlayersAdmin = createServerFn({ method: "GET" }).handler(async () => {
const { asc, eq } = await import("drizzle-orm");
const { db } = await import("@/db");
const { players } = await import("@/db/schema");
const { guard } = await import("@/lib/guard");
const { usersWithoutPlayer } = await import("@/server/admin");
const { checkedInPlayers } = await import("@/server/attendance");
const viewer = await guard("gamemaster");
const running = viewer.season.phase === "running";
const [list, present] = await Promise.all([
        db
            .select({
            id: players.id,
            name: players.name,
            status: players.status,
            killCount: players.killCount,
            studyProgram: players.studyProgram,
            studyStartYear: players.studyStartYear,
            imageKey: players.imageKey,
            imageApprovedAt: players.imageApprovedAt,
            imageRejectedReason: players.imageRejectedReason,
            imageDeleted: players.imageDeleted,
            bio: players.bio,
        })
            .from(players)
            .where(eq(players.seasonId, viewer.season.id))
            .orderBy(asc(players.name)),
        running ? checkedInPlayers(viewer.season.id) : new Set<string>(),
    ]);
const rows = list.map((p) => ({ ...p, checkedIn: running && p.status === "alive" ? present.has(p.id) : null }));
const pending = rows.filter((p) => imageStatus(p)?.tone === "amber");
const rest = rows.filter((p) => imageStatus(p)?.tone !== "amber");
const waiting = pending.length;
const noBio = rows.filter((p) => bioFilled(p.bio) === 0).length;
const candidates = viewer.isGamemaster ? await usersWithoutPlayer(viewer.season.id) : [];
return { viewer, running, list, present, rows, pending, rest, waiting, noBio, candidates };
});
