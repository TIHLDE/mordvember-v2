import { ActionForm } from "@/components/ActionForm";
import { Badge, Button, Card, Empty, inputClass, PageTitle } from "@/components/ui";
import { formatOsloDate, weekStartOf } from "@/game/time";
import { guard } from "@/lib/guard";
import { evaluateSeasonWeek, reviews } from "@/server/weekly";
import { buildFridayListAction, decideReviewAction, disqualifyAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function FridayList() {
  const viewer = await guard("staff");
  const all = await reviews(viewer.season.id);
  const pending = all.filter((r) => r.review.decision === "pending");
  const decided = all.filter((r) => r.review.decision !== "pending");
  const running = viewer.season.phase === "running";
  const current = running ? await evaluateSeasonWeek(viewer.season, weekStartOf(new Date())) : [];
  const atRisk = current.filter((c) => !c.evaluation.ok);

  return (
    <div className="space-y-4">
      <PageTitle sub="Lista lages automatisk fredag kl. 16.00. Ingen ryker automatisk.">Fredagslista</PageTitle>
      <Card title="Til gjennomgang">
        {pending.length === 0 ? (
          <Empty>Ingen saker.</Empty>
        ) : (
          <ul className="space-y-4">
            {pending.map(({ review, name, status }) => (
              <li key={review.id} className="rounded-lg border border-white/10 p-4 text-sm">
                <p className="font-medium text-white">
                  {name} <span className="text-zinc-500">· uke fra {formatOsloDate(review.weekStart)}</span>
                </p>
                <ul className="mt-1 list-inside list-disc text-zinc-400">
                  {review.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {status !== "alive" && <p className="mt-1 text-xs text-zinc-500">Allerede ute av spillet.</p>}
                <ActionForm action={decideReviewAction} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input name="reason" required placeholder="Begrunnelse" className={`${inputClass} flex-1`} />
                  <Button type="submit" name="decision" value="exception" variant="ghost">Unntak</Button>
                  <Button type="submit" name="decision" value="disqualified" variant="danger">Diskvalifiser</Button>
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
            <ul className="space-y-1 text-sm">
              {atRisk.map(({ player, evaluation }) => (
                <li key={player.id}>
                  {player.name} <span className="text-zinc-500">· {evaluation.missing.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={buildFridayListAction} className="mt-3" confirm="Lage fredagslista for denne uka nå?">
            <Button type="submit" variant="ghost">Lag lista for denne uka nå</Button>
          </ActionForm>
        </Card>
      )}
      {running && (
        <Card title="Diskvalifiser manuelt">
          <ActionForm action={disqualifyAction} className="flex flex-wrap gap-2" confirm="Diskvalifisere deltakeren?">
            <select name="playerId" required className={`${inputClass} w-auto`}>
              {current.map(({ player }) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
            <input name="reason" required placeholder="Begrunnelse" className={`${inputClass} flex-1`} />
            <Button type="submit" variant="danger">Diskvalifiser</Button>
          </ActionForm>
        </Card>
      )}
      <Card title="Avgjort">
        {decided.length === 0 ? (
          <Empty>Ingen ennå.</Empty>
        ) : (
          <ul className="space-y-1 text-sm">
            {decided.map(({ review, name }) => (
              <li key={review.id}>
                {name} · {formatOsloDate(review.weekStart)}{" "}
                {review.decision === "exception" ? <Badge tone="green">Unntak</Badge> : <Badge tone="red">Diskvalifisert</Badge>}{" "}
                <span className="text-zinc-500">{review.decisionReason}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
