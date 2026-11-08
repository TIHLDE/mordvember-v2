import { Link } from "@tanstack/react-router";
import { cx } from "./styles";

export function PendingKillBanner({ className, waiting }: { className: string; waiting: boolean }) {
  if (!waiting) return null;
  return (
    <div className="bg-blood/90 text-white">
      <div
        className={cx(
          className,
          "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 text-sm",
        )}
      >
        <span>Et drap du er part i venter på svar fra deg.</span>
        <Link
          to="/drap"
          className="inline-flex min-h-8 items-center rounded-lg bg-white/15 px-3 font-medium transition-colors hover:bg-white/25"
        >
          Bekreft eller avvis
        </Link>
      </div>
    </div>
  );
}
