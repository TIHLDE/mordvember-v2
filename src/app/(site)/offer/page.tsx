import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { redirectToLogin } from "@/lib/guard";
import { getViewer } from "@/server/auth/session";
import { revealTargetAction } from "../actions";
import { RevealButton } from "./RevealButton";

export const dynamic = "force-dynamic";

export default async function TargetPage() {
  const viewer = await getViewer();
  if (!viewer) return redirectToLogin();
  if (!viewer.player) redirect("/");
  const running = viewer.season?.phase === "running";
  return (
    <div className="mx-auto max-w-md text-center">
      <PageTitle center sub="Pass på at ingen ser skjermen din. Navn, bilde, beskrivelse og innsjekk vises til du trykker Skjul eller forlater siden.">Mitt offer</PageTitle>
      {!running ? (
        <p className="text-zinc-400">Spillet har ikke startet.</p>
      ) : viewer.player.status !== "alive" ? (
        <p className="text-zinc-400">Du er ute av spillet.</p>
      ) : (
        <RevealButton reveal={revealTargetAction} />
      )}
    </div>
  );
}
