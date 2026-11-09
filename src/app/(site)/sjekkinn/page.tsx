import { cookies } from "@/server/cookies";
import {
  myAttendance,
  PENDING_SCAN_COOKIE,
  readPendingScan,
  SCAN_RESULT_COOKIE,
} from "@/server/attendance";
import { getViewer } from "@/server/auth/session";
import { requireViewer } from "@/server/auth/session";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

import { Notice, PageTitle } from "@/components/ui";
import { sessionCountsAt } from "@/game/attendance";
import { formatOslo, osloDate } from "@/game/time";

import { completeScanAction } from "../actions";
import { CheckinButton } from "./CheckinButton";
import { TimeLeft } from "./TimeLeft";

const loadCheckin = createServerFn({ method: "GET" })
  .validator((value: unknown) => (typeof value === "string" ? value : ""))
  .handler(async ({ data: feil }) => {
    const viewer = await getViewer();
    const jar = cookies();
    const season = viewer?.season;
    const pending = season
      ? readPendingScan(jar.get(PENDING_SCAN_COOKIE)?.value, season.id)
      : !!jar.get(PENDING_SCAN_COOKIE);
    const invalidCode = feil === "kode" && !pending;
    if (!viewer && !invalidCode) {
      await requireViewer();
    }
    const done = pending ? null : jar.get(SCAN_RESULT_COOKIE)?.value;
    const now = new Date();
    return {
      invalidCode,
      player: !!viewer?.player,
      pending,
      done,
      now,
      attendance: viewer?.player ? await myAttendance(viewer, now) : null,
    };
  });

type Attendance = NonNullable<Awaited<ReturnType<typeof loadCheckin>>["attendance"]>;

export const Route = createFileRoute("/(site)/sjekkinn/")({
  validateSearch: (search: Record<string, unknown>): { feil?: string; next?: string } => ({
    feil: typeof search.feil === "string" ? search.feil : undefined,
  }),
  loaderDeps: ({ search }) => ({ feil: search.feil }),
  loader: ({ deps }) => loadCheckin({ data: deps.feil ?? "" }),
  component: CheckinPage,
});

function CheckinPage() {
  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <PageTitle center>Oppmøte</PageTitle>
      <CheckinState />
    </div>
  );
}

function CheckinState() {
  const { invalidCode, player, pending, done, now, attendance } = Route.useLoaderData();
  const open = attendance?.open;
  if (invalidCode)
    return <p className="text-red-400">QR-koden er utløpt eller ugyldig. Skann på nytt.</p>;
  // A scanned code stays pending for ten minutes, so the check-in can be finished after logging in.
  if (!player) return <p className="text-zinc-400">Du er ikke påmeldt.</p>;
  if (!pending && !done)
    return (
      <p className="text-zinc-400">Skann QR-koden på statusskjermen for å sjekke inn eller ut.</p>
    );
  if (done === "out")
    return (
      <div className="space-y-4">
        <p className="success-pop font-display text-4xl text-emerald-400">Du er sjekket ut</p>
        {attendance && <Requirements attendance={attendance} now={now} />}
      </div>
    );
  if (done === "forgotten") {
    return (
      <Notice tone="amber">
        Du glemte å sjekke ut, så økta er lukket uten å telle som oppmøte. Var du der, kan
        spillmesterne godkjenne den.
      </Notice>
    );
  }
  if (done === "in") {
    return (
      <div className="space-y-4">
        <p className="success-pop font-display text-4xl text-emerald-400">Du er sjekket inn</p>
        {attendance && open && <SessionStatus attendance={attendance} open={open} now={now} />}
        {attendance && <Requirements attendance={attendance} now={now} />}
      </div>
    );
  }
  if (!attendance || !open) {
    return (
      <div className="space-y-4">
        {attendance?.stale && (
          <Notice tone="amber">
            Du sjekket inn {formatOslo(attendance.stale.checkInAt)} og glemte å sjekke ut. Den økta
            lukkes uten å telle som oppmøte, enten du sjekker inn på nytt eller bare sjekker ut. Var
            du der, kan spillmesterne godkjenne den.
          </Notice>
        )}
        <p className="text-zinc-300">Du er ikke sjekket inn.</p>
        <CheckinButton intent="in" complete={completeScanAction} />
        {attendance?.stale && <CheckinButton intent="out" complete={completeScanAction} />}
        {attendance && <Requirements attendance={attendance} now={now} />}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <SessionStatus attendance={attendance} open={open} now={now} checkout />
      <Requirements attendance={attendance} now={now} />
    </div>
  );
}

function todayProgress(attendance: Attendance, open: NonNullable<Attendance["open"]>) {
  const today = attendance.days.find((d) => d.date === osloDate(open.checkInAt));
  const countsAt = sessionCountsAt(open.checkInAt, attendance.rules);
  return {
    today,
    alreadyCounts: !!today?.counts,
    countsAt,
    // Weekends and rejected sessions never count, however long the player stays.
    canCount: !!today && !open.rejected && countsAt.reachable,
  };
}

// What is still missing for this week's requirement, shown after every scan.
function Requirements({ attendance, now }: { attendance: Attendance; now: Date }) {
  const { rules, counted, required, kills, exempt, open } = attendance;
  if (exempt) return <p className="text-sm text-zinc-400">Du har ingen krav denne uka.</p>;
  const progress = open ? todayProgress(attendance, open) : null;
  const daysLeft = Math.max(0, required - counted);
  const killsLeft = Math.max(0, rules.killsRequired - kills);
  const rows: { label: string; value: string; left: React.ReactNode }[] = [
    {
      label: "Oppmøte",
      value: `${counted} av ${required} dag${required === 1 ? "" : "er"}`,
      left: daysLeft ? `${daysLeft} dag${daysLeft === 1 ? "" : "er"} igjen` : null,
    },
  ];
  if (daysLeft && progress?.canCount && !progress.alreadyCounts) {
    rows.push({
      label: "I dag",
      value: `${rules.hours} time${rules.hours === 1 ? "" : "r"}`,
      left: <TimeLeft remainingMs={progress.countsAt.at.getTime() - now.getTime()} />,
    });
  }
  if (rules.killsRequired > 0) {
    rows.push({
      label: "Drap",
      value: `${kills} av ${rules.killsRequired}`,
      left: killsLeft ? `${killsLeft} drap igjen` : null,
    });
  }
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm">
      <h2 className="mb-2 font-semibold text-white">Krav denne uka</h2>
      <dl className="divide-y divide-white/5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-zinc-400">{row.label}</dt>
            <dd className="text-right tabular-nums">
              <span className="text-zinc-300">{row.value}</span>
              <span className={row.left ? "block text-amber-300" : "block text-emerald-400"}>
                {row.left ?? "Oppfylt"}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SessionStatus({
  attendance,
  open,
  now,
  checkout = false,
}: {
  attendance: Attendance;
  open: NonNullable<Attendance["open"]>;
  now: Date;
  checkout?: boolean;
}) {
  const { rules } = attendance;
  const { today, alreadyCounts, countsAt, canCount } = todayProgress(attendance, open);
  const hours = `${rules.hours} time${rules.hours === 1 ? "" : "r"}`;
  // Rounded up, so the shown minute is never before the day actually counts.
  const countsAtLabel = formatOslo(
    new Date(Math.ceil(countsAt.at.getTime() / 60000) * 60000),
    false,
  );
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
