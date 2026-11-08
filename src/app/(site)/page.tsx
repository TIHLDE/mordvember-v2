import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Card, LinkButton, PageTitle } from "@/components/ui";
import { PlayerGrid } from "@/components/PlayerGrid";
import { ReviewList } from "@/components/ReviewList";
import type { Season, Viewer } from "@/server/auth/session";

import type { myReviewItems } from "@/server/review";

const loadHome = createServerFn({ method: "GET" }).handler(async () => {
 const { getViewer } = await import("@/server/auth/session");
 const { gridPlayers, visibleAliveCount } = await import("@/server/players");
 const { myReviewItems } = await import("@/server/review");
 const { getCurrentSeason, phaseLabel, signupOpen } = await import("@/server/season");
 const viewer = await getViewer();
 const season = viewer?.season ?? await getCurrentSeason();
 if (!season) return null;
 // Only authenticated members may receive the participant roster.
 const grid = viewer ? await gridPlayers(season.id) : [];
 const alive = visibleAliveCount(grid);
 return { viewer, season, grid, alive, phase: phaseLabel(season.phase), open: signupOpen(season), items: viewer?.player ? await myReviewItems(viewer) : [] };
});
function Home() {
 const data = Route.useLoaderData();
 if (!data) return <PageTitle sub="Spillet er ikke satt opp ennå.">Mordvember</PageTitle>;
 const { viewer, season, grid, alive, phase, open, items } = data;
 const winner = season.winnerPlayerId && alive === 1 ? grid.find(p => !p.out) : null;
 const info = season.settings.info;
 const started = season.phase === "running" || season.phase === "ended";
    return (<div className="space-y-6">
      <PageTitle sub={`${season.name} · ${phase}`} aside={<>
            <p className="text-xs text-zinc-400 sm:text-sm">{started ? "Spillere igjen" : "Påmeldt"}</p>
            <p className="mt-1 font-display text-5xl leading-none text-blood tabular-nums sm:text-6xl">{started ? alive : grid.length}</p>
          </>}>
        Mordvember
      </PageTitle>

      {winner && viewer && (<Card>
          <p className="text-sm text-zinc-400">Vinner</p>
          <p className="mt-2 font-display text-4xl leading-none text-blood sm:text-5xl">{winner.name}</p>
        </Card>)}

      <Card title="Regler">
        <div className="space-y-3 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{info.rules}</div>
      </Card>

      <ViewerCard viewer={viewer} season={season} open={open} items={items}/>

      {viewer && grid.length > 0 && (<section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-white">Deltakere</h2>
          <PlayerGrid players={grid}/>
        </section>)}
    </div>);
}
// What the visitor can do next: log in, sign up, or see how they are doing.
function ViewerCard({ viewer, season, open, items }: {
    open: boolean;
    items: Awaited<ReturnType<typeof myReviewItems>>;
    viewer: Viewer | null;
    season: Season;
}) {
    if (!viewer) {
        return (<Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-zinc-300">Logg inn med TIHLDE-brukeren din for å se deltakerne og melde deg på.</p>
        <LinkButton href="/login">Logg inn</LinkButton>
      </Card>);
    }
    if (viewer.player) {
        return (<Card>
        <p className="mb-4 text-sm text-zinc-300">Du er påmeldt. {playerStatus(viewer.player, season)}</p>
        <ReviewList items={items}/>
      </Card>);
    }
    if (viewer.isGamemaster || !open)
        return null;
    return (<Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-zinc-300">Påmeldingen er åpen.</p>
      <LinkButton href="/pamelding">Meld deg på</LinkButton>
    </Card>);
}
function playerStatus(player: NonNullable<Viewer["player"]>, season: Season) {
    if (season.winnerPlayerId === player.id)
        return "Du vant!";
    if (player.status !== "alive")
        return "Du er ute av spillet.";
    return season.phase === "running" ? "Du er fortsatt med." : "Spillet har ikke startet ennå.";
}

export const Route = createFileRoute("/(site)/")({ loader: () => loadHome(), component: Home });
