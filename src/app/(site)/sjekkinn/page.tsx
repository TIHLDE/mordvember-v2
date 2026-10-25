import { cookies } from "next/headers";
import { PageTitle } from "@/components/ui";
import { sessionCountsAt } from "@/game/attendance";
import { formatOslo, osloDate } from "@/game/time";
import { redirectToLogin } from "@/lib/guard";
import { myAttendance, PENDING_SCAN_COOKIE, readPendingScan, SCAN_RESULT_COOKIE } from "@/server/attendance";
import { getViewer } from "@/server/auth/session";
import { completeScanAction } from "../actions";
import { CheckinButton } from "./CheckinButton";

export const dynamic = "force-dynamic";

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ feil?: string }> }) {
  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <PageTitle center>Oppmøte</PageTitle>
      <CheckinState searchParams={searchParams} />
    </div>
  );
}

async function CheckinState({ searchParams }: { searchParams: Promise<{ feil?: string }> }) {
  const [{ feil }, viewer, jar] = await Promise.all([searchParams, getViewer(), cookies()]);
  const season = viewer?.season;
  const pending = season ? readPendingScan(jar.get(PENDING_SCAN_COOKIE)?.value, season.id) : !!jar.get(PENDING_SCAN_COOKIE);

  if (feil === "kode" && !pending) return <p className="text-red-400">QR-koden er utløpt eller ugyldig. Skann på nytt.</p>;
  // A scanned code stays pending for ten minutes, so the check-in can be finished after logging in.
  if (!viewer) return redirectToLogin();
  if (!viewer.player) return <p className="text-zinc-400">Du er ikke påmeldt.</p>;
  const done = pending ? null : jar.get(SCAN_RESULT_COOKIE)?.value;
  if (!pending && !done) return <p className="text-zinc-400">Skann QR-koden på statusskjermen for å sjekke inn eller ut.</p>;
  if (done === "out") return <p className="success-pop font-display text-4xl text-emerald-400">Du er sjekket ut</p>;
  const now = new Date();
  const attendance = await myAttendance(viewer, now);
  const open = attendance?.open;
  if (done === "in") {
    return (
      <div className="space-y-4">
        <p className="success-pop font-display text-4xl text-emerald-400">Du er sjekket inn</p>
        {attendance && open && <SessionStatus attendance={attendance} open={open} now={now} />}
      </div>
    );
  }
  if (!attendance || !open) {
    return (
      <div className="space-y-4">
        <p className="text-zinc-300">Du er ikke sjekket inn.</p>
        <CheckinButton intent="in" complete={completeScanAction} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <SessionStatus attendance={attendance} open={open} now={now} checkout />
    </div>
  );
}

type Attendance = NonNullable<Awaited<ReturnType<typeof myAttendance>>>;

function SessionStatus({ attendance, open, now, checkout = false }: { attendance: Attendance; open: NonNullable<Attendance["open"]>; now: Date; checkout?: boolean }) {
  const { rules } = attendance;
  const today = attendance.days.find((d) => d.date === osloDate(open.checkInAt));
  const alreadyCounts = !!today?.counts;
  const countsAt = sessionCountsAt(open.checkInAt, rules);
  // Weekends and rejected sessions never count, however long the player stays.
  const canCount = !!today && !open.rejected && countsAt.reachable;
  const hours = `${rules.hours} time${rules.hours === 1 ? "" : "r"}`;
  // Rounded up, so the shown minute is never before the day actually counts.
  const countsAtLabel = formatOslo(new Date(Math.ceil(countsAt.at.getTime() / 60000) * 60000), false);
  return (
    <>
      <div className="space-y-1">
        <p className="text-zinc-300">Du sjekket inn kl. {formatOslo(open.checkInAt, false)}.</p>
        <p className="text-sm text-zinc-400">
          {alreadyCounts
            ? "Dagen teller allerede."
            : canCount
              ? `Dagen teller når du har vært her i ${hours}, fra kl. ${countsAtLabel}.`
              : !today
                ? "Bare hverdager teller."
                : open.rejected
                  ? "Spillmesterne har avvist denne innsjekkingen, så den teller ikke."
                  : `Du rekker ikke ${hours} før kl. ${rules.windowEnd}, så dagen teller ikke.`}
        </p>
      </div>
      {checkout && (
        <CheckinButton
          intent="out"
          complete={completeScanAction}
          countsAt={
            !alreadyCounts && canCount
              ? // Sent as time left, so a wrong clock on the phone doesn't move the deadline.
                { remainingMs: countsAt.at.getTime() - now.getTime(), label: countsAtLabel, hours }
              : undefined
          }
        />
      )}
    </>
  );
}
