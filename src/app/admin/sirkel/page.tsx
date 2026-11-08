import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

import { ActionForm } from "@/components/ActionForm";
import { inputBase } from "@/components/styles";
import { Button, Card, Empty, PageTitle } from "@/components/ui";

import { formatOslo } from "@/game/time";

import { generateCircleAction, mercyAction, moveAction, startGameAction } from "../actions";
const EVENT_LABEL: Record<string, string> = {
  trukket: "Sirkel trukket",
  flyttet: "Deltaker flyttet",
  drap: "Drap",
  drap_angret: "Drap angret",
  nade: "Nåde",
  diskvalifisert: "Diskvalifisering",
  fjernet: "Deltaker fjernet",
};
function CirclePage() {
  const { season, circle, events, out, names, gm } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageTitle
        sub={
          gm
            ? "All visning av denne siden logges."
            : "Du ser sirkelen med nødtilgang. Visningen er logget og spillmesterne er varslet."
        }
      >
        Sirkel
      </PageTitle>

      {gm && season.phase === "closed" && (
        <Card title="Før start">
          <div className="flex flex-wrap gap-2">
            <ActionForm
              action={generateCircleAction}
              confirm={circle.length ? "Trekke sirkelen på nytt?" : undefined}
            >
              <Button type="submit" variant="ghost">
                {circle.length ? "Trekk på nytt" : "Trekk sirkel"}
              </Button>
            </ActionForm>
            {circle.length > 1 && (
              <ActionForm
                action={startGameAction}
                confirm="Starte spillet? Alle deltakere får e-post om første offer."
              >
                <Button type="submit">Start spillet</Button>
              </ActionForm>
            )}
          </div>
        </Card>
      )}
      {gm && (season.phase === "setup" || season.phase === "signup") && (
        <p className="text-sm text-zinc-400">Sirkelen trekkes når påmeldingen er stengt.</p>
      )}

      <Card title={`Sirkelen (${circle.length} levende)`}>
        {circle.length === 0 ? (
          <Empty>Ingen sirkel ennå.</Empty>
        ) : (
          <ol className="divide-y divide-white/5 text-sm">
            {circle.map((c, i) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <span>
                  <span className="mr-2 inline-block w-6 text-right text-zinc-600 tabular-nums">
                    {i + 1}.
                  </span>
                  <span className="text-white">{c.name}</span>{" "}
                  <span className="text-zinc-500">
                    → {c.targetId ? names.get(c.targetId) : "–"}
                  </span>
                  <span className="ml-2 text-xs text-zinc-500">{c.killCount} drap</span>
                </span>
                {gm && (
                  <ActionForm action={moveAction} className="flex gap-2">
                    <input type="hidden" name="playerId" value={c.id} />
                    <select
                      name="afterId"
                      aria-label="Flytt etter"
                      className={`${inputBase} w-44`}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Flytt etter …
                      </option>
                      {circle
                        .filter((o) => o.id !== c.id)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                    </select>
                    <Button type="submit" variant="ghost" size="sm">
                      Flytt
                    </Button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {gm && season.phase === "running" && (
        <Card title="Gi nåde">
          <p className="mb-4 text-sm text-zinc-400">
            Spilleren settes inn etter valgt jeger, eller på en tilfeldig plass. Krav gjelder fra
            uka etter.
          </p>
          <ActionForm action={mercyAction} className="flex flex-wrap gap-2" confirm="Gi nåde?">
            <select
              name="playerId"
              required
              aria-label="Deltaker"
              className={`${inputBase} w-auto`}
            >
              {out.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              name="afterId"
              aria-label="Plassering"
              className={`${inputBase} w-auto`}
              defaultValue=""
            >
              <option value="">Tilfeldig plass</option>
              {circle.map((c) => (
                <option key={c.id} value={c.id}>
                  Etter {c.name}
                </option>
              ))}
            </select>
            <Button type="submit">Gi nåde</Button>
          </ActionForm>
        </Card>
      )}

      <Card title="Hendelser">
        {events.length === 0 ? (
          <Empty>Ingen endringer ennå.</Empty>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {events.map((e) => (
              <li key={e.id} className="text-zinc-400">
                {formatOslo(e.createdAt)} · {EVENT_LABEL[e.type] ?? e.type} ·{" "}
                {e.actor ?? "deltakerbekreftelse"} · {e.size} i sirkelen
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/admin/sirkel/")({
  loader: ({ location }) => loadCirclePage({ headers: { "x-mv-path": location.href } }),
  component: CirclePage,
});

const loadCirclePage = createServerFn({ method: "GET" }).handler(async () => {
  const { and, asc, eq, ne } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const { players } = await import("@/db/schema");
  const { guard } = await import("@/lib/guard");
  const { circleEventsForAdmin, circleForAdmin } = await import("@/server/circle");
  const viewer = await guard("circle");
  const season = viewer.season;
  const [circle, events, out] = await Promise.all([
    circleForAdmin(viewer, "sirkelside"),
    circleEventsForAdmin(viewer),
    viewer.isGamemaster
      ? db
          .select({ id: players.id, name: players.name })
          .from(players)
          .where(and(eq(players.seasonId, season.id), ne(players.status, "alive")))
          .orderBy(asc(players.name))
      : [],
  ]);
  const names = new Map(circle.map((c) => [c.id, c.name]));
  const gm = viewer.isGamemaster;
  return {
    season,
    circle,
    events: events.map((event) => ({ ...event, payload: JSON.stringify(event.payload) })),
    out,
    names,
    gm,
  };
});
