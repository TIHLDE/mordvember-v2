import { revealTargetAction } from "../actions";
import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { PageTitle } from "@/components/ui";
import { RevealButton } from "./RevealButton";

const getTargetStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getViewer } = await import("@/server/auth/session");
  const viewer = await getViewer();
  if (!viewer) throw redirect({ to: "/login", search: { next: "/offer" } });
  if (!viewer.player) throw redirect({ to: "/" });
  return { running: viewer.season?.phase === "running", alive: viewer.player.status === "alive" };
});

export const Route = createFileRoute("/(site)/offer/")({
  loader: ({ location }) => getTargetStatus({ headers: { "x-mv-path": location.href } }),
  component: TargetPage,
});

function TargetPage() {
  const { running, alive } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-md text-center">
      <PageTitle
        center
        sub="Pass på at ingen ser skjermen din. Navn, bilde, beskrivelse og innsjekk vises til du trykker Skjul eller forlater siden."
      >
        Mitt offer
      </PageTitle>
      {!running ? (
        <p className="text-zinc-400">Spillet har ikke startet.</p>
      ) : !alive ? (
        <p className="text-zinc-400">Du er ute av spillet.</p>
      ) : (
        <RevealButton reveal={revealTargetAction} />
      )}
    </div>
  );
}
