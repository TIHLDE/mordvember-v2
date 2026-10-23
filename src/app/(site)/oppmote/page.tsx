import { redirect } from "next/navigation";
import { Badge, Card, PageTitle } from "@/components/ui";
import { formatOslo, formatOsloDate } from "@/game/time";
import { redirectToLogin } from "@/lib/guard";
import { myAttendance } from "@/server/attendance";
import { getViewer } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const viewer = await getViewer();
  if (!viewer) return redirectToLogin();
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
        <p className="text-sm text-zinc-300">Skann QR-koden på statusskjermen med mobilkameraet for å sjekke inn eller ut.</p>
      </Card>
      <Card title="I dag">
        {todays.length === 0 ? (
          <p className="text-sm text-zinc-400">Ikke sjekket inn i dag.</p>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {todays.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 py-2 first:pt-0 last:pb-0">
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
        {open && <p className="mt-4 text-sm text-emerald-400">Du er sjekket inn nå. Husk å sjekke ut.</p>}
      </Card>
      <Card title={`Denne uka: ${counted} av ${required} dager`}>
        <ul className="divide-y divide-white/5 text-sm">
          {days.map((d) => (
            <li key={d.date} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <span className="capitalize">{formatOsloDate(d.date)}</span>
              <span className="flex items-center gap-2">
                {d.longestMinutes > 0 && <span className="text-zinc-500 tabular-nums">{Math.floor(d.longestMinutes / 60)} t {d.longestMinutes % 60} min</span>}
                {d.counts ? <Badge tone="green">Teller</Badge> : d.hasUnclosed ? <Badge tone="amber">Ikke sjekket ut</Badge> : <Badge>–</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
