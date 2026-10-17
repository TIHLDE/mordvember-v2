import { Card, LinkButton, PageTitle } from "@/components/ui";
import { PlayerGrid } from "@/components/PlayerGrid";
import { getViewer } from "@/server/auth/session";
import { gridPlayers, visibleAliveCount } from "@/server/players";
import { getCurrentSeason, phaseLabel, signupOpen } from "@/server/season";
import { formatOslo } from "@/game/time";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getViewer();
  const season = viewer?.season ?? (await getCurrentSeason());
  if (!season) {
    return <PageTitle sub="Neste sesong er ikke satt opp ennå.">Mordvember</PageTitle>;
  }
  const grid = season.dataDeletedAt ? [] : await gridPlayers(season.id);
  const alive = visibleAliveCount(grid);
  const winner = season.winnerPlayerId && alive === 1 ? grid.find((p) => !p.out) : null;
  const info = season.settings.info;

  return (
    <div className="space-y-6">
      <PageTitle sub={`${season.name} · ${phaseLabel(season.phase)}`}>Mordvember</PageTitle>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2" title="Regler">
          <div className="space-y-3 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{info.rules}</div>
          {info.dates && <p className="mt-4 whitespace-pre-line text-sm text-zinc-400">{info.dates}</p>}
          {season.signupDeadline && season.phase === "signup" && (
            <p className="mt-4 text-sm text-zinc-400">Påmeldingsfrist: {formatOslo(season.signupDeadline)}</p>
          )}
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Spillere igjen</p>
          <p className="mt-2 font-display text-6xl leading-none text-blood tabular-nums">{season.phase === "running" || season.phase === "ended" ? alive : grid.length}</p>
          {season.phase !== "running" && season.phase !== "ended" && <p className="text-xs text-zinc-500">påmeldt</p>}
          {winner && viewer && <p className="mt-3 text-sm">Vinner: <strong className="text-white">{winner.name}</strong></p>}
          {season.dataDeletedAt && season.winnerName && <p className="mt-3 text-sm">Vinner: {season.winnerName}</p>}
        </Card>
      </div>

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
