import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { getViewer } from "@/server/auth/session";
import { revealTargetAction } from "../actions";
import { RevealButton } from "./RevealButton";

export const dynamic = "force-dynamic";

export default async function TargetPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/offer");
  if (!viewer.player) redirect("/");
  const running = viewer.season?.phase === "running";
  return (
    <div className="mx-auto max-w-md text-center">
      <PageTitle sub="Pass på at ingen ser skjermen din. Navn og bilde vises bare så lenge du holder inne.">Mitt offer</PageTitle>
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
