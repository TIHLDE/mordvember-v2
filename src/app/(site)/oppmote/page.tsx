import { redirect } from "next/navigation";
import { Badge, Card, PageTitle } from "@/components/ui";
import { formatOslo, formatOsloDate } from "@/game/time";
import { myAttendance } from "@/server/attendance";
import { getViewer } from "@/server/auth/session";
import { Scanner } from "./Scanner";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/oppmote");
  if (!viewer.player) redirect("/");
  const status = await myAttendance(viewer);
  if (!status) redirect("/");
  const { rules, days, todays, open, counted, required } = status;
  return (
    <div className="space-y-6">
      <PageTitle
        sub={`Krav denne uka: ${rules.days} dager med minst ${rules.hours} timer sammenhengende mellom ${rules.windowStart} og ${rules.windowEnd}${rules.killsRequired ? `, og ${rules.killsRequired} drap` : ""}.`}
      >
        Oppmøte
      </PageTitle>
      <Card>
        <Scanner />
        <p className="mt-3 text-xs text-zinc-500">Første skanning sjekker deg inn, neste sjekker deg ut. Du kan også bruke mobilens vanlige kamera.</p>
      </Card>
      <Card title="I dag">
        {todays.length === 0 ? (
          <p className="text-sm text-zinc-400">Ikke sjekket inn i dag.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {todays.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <span>
                  Inn {formatOslo(c.checkInAt, false)}
                  {c.checkOutAt ? ` · ut ${formatOslo(c.checkOutAt, false)}` : ""}
                </span>
                {c.autoClosed && <Badge tone="amber">Ikke sjekket ut</Badge>}
                {c.rejected && <Badge tone="red">Underkjent</Badge>}
              </li>
            ))}
          </ul>
        )}
        {open && <p className="mt-2 text-sm text-emerald-400">Du er sjekket inn nå. Husk å sjekke ut.</p>}
      </Card>
      <Card title={`Denne uka: ${counted} av ${required} dager`}>
        <ul className="space-y-1 text-sm">
          {days.map((d) => (
            <li key={d.date} className="flex flex-wrap items-center justify-between gap-2">
              <span className="capitalize">{formatOsloDate(d.date)}</span>
              <span className="flex items-center gap-2">
                {d.longestMinutes > 0 && <span className="text-zinc-500">{Math.floor(d.longestMinutes / 60)} t {d.longestMinutes % 60} min</span>}
                {d.counts ? <Badge tone="green">Teller</Badge> : d.hasUnclosed ? <Badge tone="amber">Ikke sjekket ut</Badge> : <Badge>–</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
