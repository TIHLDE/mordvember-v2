import { guard } from "@/lib/guard";
import { evaluateSeasonWeek, missingFridayLists, reviews } from "@/server/weekly";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { ActionForm } from "@/components/ActionForm";
import { inputBase, inputClass } from "@/components/styles";
import { Badge, Button, Card, Empty, Notice, PageTitle } from "@/components/ui";
import { earlierGameWeeks } from "@/game/friday";
import { formatOsloDate, weekStartOf } from "@/game/time";

import { buildFridayListAction, decideReviewAction, disqualifyAction } from "../actions";

const loadFridayList = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = await guard("gamemaster");
  const all = await reviews(viewer.season.id);
  const pending = all.filter((r) => r.review.decision === "pending");
  const decided = all.filter((r) => r.review.decision !== "pending");
  const running = viewer.season.phase === "running";
  const now = new Date();
  const thisWeek = weekStartOf(now);
  const current = running ? await evaluateSeasonWeek(viewer.season, thisWeek, now) : [];
  const atRisk = current.filter((c) => !c.evaluation.ok);
  const earlier =
    running && viewer.season.startedAt ? earlierGameWeeks(viewer.season.startedAt, now) : [];
  const missing = await missingFridayLists(viewer.season.id, earlier);
  return { pending, decided, running, thisWeek, current, atRisk, earlier, missing };
});

export const Route = createFileRoute("/admin/fredag/")({
  loader: () => loadFridayList(),
  component: FridayList,
});

function FridayList() {
  const { pending, decided, running, thisWeek, current, atRisk, earlier, missing } =
    Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageTitle sub="Lista lages automatisk fredag kl. 16.00. Ingen ryker automatisk.">
        Fredagslista
      </PageTitle>
      <Card title="Til gjennomgang">
        {pending.length === 0 ? (
          <Empty>Ingen saker.</Empty>
        ) : (
          <ul className="divide-y divide-white/5">
            {pending.map(({ review, name, status }) => (
              <li key={review.id} className="py-5 text-sm first:pt-0 last:pb-0">
                <p className="font-medium text-white">
                  {name}{" "}
                  <span className="text-zinc-500">
                    · uke fra {formatOsloDate(review.weekStart)}
                  </span>
                </p>
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-zinc-400">
                  {review.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {status !== "alive" && (
                  <p className="mt-1 text-xs text-zinc-500">Allerede ute av spillet.</p>
                )}
                <ActionForm action={decideReviewAction} className="mt-4 flex flex-wrap gap-2">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input
                    name="reason"
                    required
                    aria-label="Begrunnelse"
                    placeholder="Begrunnelse"
                    className={`${inputClass} min-w-48 flex-1`}
                  />
                  <Button type="submit" name="decision" value="exception" variant="ghost">
                    Unntak
                  </Button>
                  <Button type="submit" name="decision" value="disqualified" variant="danger">
                    Diskvalifiser
                  </Button>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {running && (
        <Card title="Ligger an til å ryke denne uka">
          {atRisk.length === 0 ? (
            <Empty>Alle har nådd kravet så langt.</Empty>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {atRisk.map(({ player, evaluation }) => (
                <li key={player.id}>
                  {player.name}{" "}
                  <span className="text-zinc-500">· {evaluation.missing.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
          <ActionForm
            action={buildFridayListAction}
            className="mt-5"
            confirm="Lage fredagslista for denne uka nå?"
          >
            <input type="hidden" name="week" value={thisWeek} />
            <Button type="submit" variant="ghost">
              Lag lista for denne uka nå
            </Button>
          </ActionForm>
        </Card>
      )}
      {earlier.length > 0 && (
        <Card title="Tidligere uker">
          {missing.length > 0 && (
            <div className="mb-4 space-y-2">
              {missing.map((week) => (
                <Notice key={week} tone="amber">
                  Uka fra {formatOsloDate(week)} har ingen fredagsliste.
                </Notice>
              ))}
            </div>
          )}
          <ActionForm
            action={buildFridayListAction}
            className="flex flex-wrap gap-2"
            confirm="Lage fredagslista for den valgte uka? Saker som allerede finnes, blir ikke endret."
          >
            <select
              name="week"
              required
              defaultValue={missing[0] ?? earlier[0]}
              aria-label="Uke"
              className={`${inputBase} w-auto`}
            >
              {earlier.map((week) => (
                <option key={week} value={week}>
                  Uke fra {formatOsloDate(week)}
                  {missing.includes(week) ? " · mangler liste" : ""}
                </option>
              ))}
            </select>
            <Button type="submit" variant="ghost">
              Lag lista for valgt uke
            </Button>
          </ActionForm>
        </Card>
      )}
      {running && (
        <Card title="Diskvalifiser manuelt">
          <ActionForm
            action={disqualifyAction}
            className="flex flex-wrap gap-2"
            confirm="Diskvalifisere deltakeren?"
          >
            <select
              name="playerId"
              required
              aria-label="Deltaker"
              className={`${inputBase} w-auto`}
            >
              {current.map(({ player }) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
            <input
              name="reason"
              required
              aria-label="Begrunnelse"
              placeholder="Begrunnelse"
              className={`${inputClass} min-w-48 flex-1`}
            />
            <Button type="submit" variant="danger">
              Diskvalifiser
            </Button>
          </ActionForm>
        </Card>
      )}
      <Card title="Avgjort">
        {decided.length === 0 ? (
          <Empty>Ingen ennå.</Empty>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {decided.map(({ review, name }) => (
              <li
                key={review.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-white">{name}</span>
                <span className="text-zinc-500">{formatOsloDate(review.weekStart)}</span>
                {review.decision === "exception" ? (
                  <Badge tone="green">Unntak</Badge>
                ) : (
                  <Badge tone="red">Diskvalifisert</Badge>
                )}
                <span className="text-zinc-500">{review.decisionReason}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
