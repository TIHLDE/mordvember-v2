import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Button, Card, Empty, inputClass, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { players } from "@/db/schema";
import { addDays, formatOslo, formatOsloDate, weekStartOf } from "@/game/time";
import { osloInputValue } from "@/lib/action";
import { guard } from "@/lib/guard";
import { weekSessions } from "@/server/attendance";
import { addCheckinAction, editCheckinAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AttendanceAdmin({ searchParams }: { searchParams: Promise<{ uke?: string }> }) {
  const viewer = await guard("staff");
  const { uke } = await searchParams;
  const week = uke && /^\d{4}-\d{2}-\d{2}$/.test(uke) ? uke : weekStartOf(new Date());
  const rows = await weekSessions(viewer.season.id, week);
  const roster = await db.select({ id: players.id, name: players.name }).from(players).where(eq(players.seasonId, viewer.season.id)).orderBy(asc(players.name));
  const flagged = rows.filter((r) => !r.checkin.flagsReviewed && !r.checkin.rejected && (r.checkin.autoClosed || r.checkin.flags.length > 0));

  const row = (c: (typeof rows)[number]) => (
    <li key={c.checkin.id} className="space-y-2 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-white">{c.name}</span>
        <span className="text-zinc-400">
          {formatOslo(c.checkin.checkInAt)} – {c.checkin.checkOutAt ? formatOslo(c.checkin.checkOutAt, false) : "åpen"}
        </span>
        {c.checkin.autoClosed && !c.checkin.approved && <Badge tone="amber">Ikke sjekket ut</Badge>}
        {c.checkin.approved && <Badge tone="green">Godkjent</Badge>}
        {c.checkin.rejected && <Badge tone="red">Underkjent</Badge>}
        {c.checkin.flags.map((f) => (
          <Badge key={f} tone="amber">{f}</Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(["approve", "reject", "reviewed", "restore"] as const).map((kind) => (
          <ActionForm key={kind} action={editCheckinAction}>
            <input type="hidden" name="checkinId" value={c.checkin.id} />
            <input type="hidden" name="kind" value={kind} />
            <Button type="submit" variant="ghost">
              {{ approve: "Godkjenn", reject: "Underkjenn", reviewed: "OK, sett som sett", restore: "Nullstill" }[kind]}
            </Button>
          </ActionForm>
        ))}
        <ActionForm action={editCheckinAction} className="flex flex-wrap items-center gap-1">
          <input type="hidden" name="checkinId" value={c.checkin.id} />
          <input type="hidden" name="kind" value="times" />
          <input type="datetime-local" name="checkInAt" defaultValue={osloInputValue(c.checkin.checkInAt)} className={`${inputClass} w-auto`} />
          <input
            type="datetime-local"
            name="checkOutAt"
            defaultValue={c.checkin.checkOutAt ? osloInputValue(c.checkin.checkOutAt) : ""}
            className={`${inputClass} w-auto`}
          />
          <Button type="submit" variant="ghost">Rett tider</Button>
        </ActionForm>
      </div>
    </li>
  );

  return (
    <div className="space-y-4">
      <PageTitle sub={`Uke fra ${formatOsloDate(week)}`}>Oppmøte</PageTitle>
      <div className="flex gap-3 text-sm">
        <Link href={`/admin/oppmote?uke=${addDays(week, -7)}`} className="underline">Forrige uke</Link>
        <Link href={`/admin/oppmote?uke=${addDays(week, 7)}`} className="underline">Neste uke</Link>
      </div>
      <Card title="Merket for gjennomgang">{flagged.length ? <ul className="divide-y divide-white/5">{flagged.map(row)}</ul> : <Empty>Ingen.</Empty>}</Card>
      <Card title="Alle innsjekker">{rows.length ? <ul className="divide-y divide-white/5">{rows.map(row)}</ul> : <Empty>Ingen innsjekker denne uka.</Empty>}</Card>
      <Card title="Legg inn oppmøte manuelt">
        <ActionForm action={addCheckinAction} className="flex flex-wrap gap-2">
          <select name="playerId" required className={`${inputClass} w-auto`}>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input type="datetime-local" name="checkInAt" required className={`${inputClass} w-auto`} />
          <input type="datetime-local" name="checkOutAt" required className={`${inputClass} w-auto`} />
          <Button type="submit">Legg til</Button>
        </ActionForm>
      </Card>
    </div>
  );
}
