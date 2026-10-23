import { Card, LinkButton, PageTitle } from "@/components/ui";
import { PlayerGrid } from "@/components/PlayerGrid";
import { getViewer } from "@/server/auth/session";
import { gridPlayers, visibleAliveCount } from "@/server/players";
import { getCurrentSeason, phaseLabel, signupOpen } from "@/server/season";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getViewer();
  const season = viewer?.season ?? (await getCurrentSeason());
  if (!season) {
    return <PageTitle sub="Spillet er ikke satt opp ennå.">Mordvember</PageTitle>;
  }
  const grid = await gridPlayers(season.id);
  const alive = visibleAliveCount(grid);
  const winner = season.winnerPlayerId && alive === 1 ? grid.find((p) => !p.out) : null;
  const info = season.settings.info;
  const started = season.phase === "running" || season.phase === "ended";

  return (
    <div className="space-y-6">
      <PageTitle
        sub={`${season.name} · ${phaseLabel(season.phase)}`}
        aside={
          <>
            <p className="text-xs text-zinc-400 sm:text-sm">{started ? "Spillere igjen" : "Påmeldt"}</p>
            <p className="mt-1 font-display text-5xl leading-none text-blood tabular-nums sm:text-6xl">{started ? alive : grid.length}</p>
          </>
        }
      >
        Mordvember
      </PageTitle>

      {winner && viewer && (
        <Card>
          <p className="text-sm text-zinc-400">Vinner</p>
          <p className="mt-2 font-display text-4xl leading-none text-blood sm:text-5xl">{winner.name}</p>
        </Card>
      )}

      <Card title="Regler">
        <div className="space-y-3 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{info.rules}</div>
      </Card>

      {!viewer && (
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-zinc-300">Logg inn med TIHLDE-brukeren din for å se deltakerne og melde deg på.</p>
          <LinkButton href="/login">Logg inn</LinkButton>
        </Card>
      )}

      {viewer && !viewer.player && !viewer.isGamemaster && signupOpen(season) && (
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-zinc-300">Påmeldingen er åpen.</p>
          <LinkButton href="/pamelding">Meld deg på</LinkButton>
        </Card>
      )}

      {viewer && viewer.player && (
        <Card>
          <p className="text-sm text-zinc-300">
            Du er påmeldt.{" "}
            {season.winnerPlayerId === viewer.player.id
              ? "Du vant!"
              : viewer.player.status === "alive"
              ? season.phase === "running"
                ? "Du er fortsatt med."
                : "Spillet har ikke startet ennå."
              : "Du er ute av spillet."}
          </p>
        </Card>
      )}

      {viewer && grid.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-white">Deltakere</h2>
          <PlayerGrid players={grid} />
        </section>
      )}
    </div>
  );
}
