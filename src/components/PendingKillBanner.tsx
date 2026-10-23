import Link from "next/link";
import { getViewer } from "@/server/auth/session";
import { openKillsForPlayer } from "@/server/game";
import { cx } from "./styles";

export async function PendingKillBanner({ className }: { className: string }) {
  const viewer = await getViewer();
  if (!viewer?.season || !viewer.player) return null;
  const playerId = viewer.player.id;
  const open = await openKillsForPlayer(viewer.season.id, playerId);
  const waiting = open.some((k) => k.status === "pending" && (k.reportedBy === "killer" ? k.victimId : k.killerId) === playerId);
  if (!waiting) return null;
  return (
    <div className="bg-blood/90 text-white">
      <div className={cx(className, "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 text-sm")}>
        <span>Et drap du er part i venter på svar fra deg.</span>
        <Link href="/drap" className="inline-flex min-h-8 items-center rounded-lg bg-white/15 px-3 font-medium transition-colors hover:bg-white/25">
          Bekreft eller avvis
        </Link>
      </div>
    </div>
  );
}
