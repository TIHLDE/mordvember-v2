import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

import { ActionForm } from "@/components/ActionForm";
import { DateTimePicker } from "@/components/DateTimePicker";
import { inputBase } from "@/components/styles";
import { Badge, Button, Card, Empty, Field, LinkButton, PageTitle } from "@/components/ui";

import { addDays, formatOslo, formatOsloDate, weekStartOf } from "@/game/time";
import { osloInputValue } from "@/lib/oslo-input";

import { addCheckinAction, editCheckinAction } from "../actions";

const loadAttendanceAdmin = createServerFn({ method: "GET" })
  .validator((value: unknown) => {
    if (typeof value !== "string") throw new Error("Ugyldig parameter");
    return value;
  })
  .handler(async ({ data }) => {
    const { asc, eq } = await import("drizzle-orm");
    const { db } = await import("@/db");
    const { players } = await import("@/db/schema");
    const { guard } = await import("@/lib/guard");
    const { weekSessions } = await import("@/server/attendance");
    const viewer = await guard("gamemaster");
    const { uke } = { uke: data };
    const week = uke && /^\d{4}-\d{2}-\d{2}$/.test(uke) ? uke : weekStartOf(new Date());
    const [rows, roster] = await Promise.all([
      weekSessions(viewer.season.id, week),
      db
        .select({ id: players.id, name: players.name })
        .from(players)
        .where(eq(players.seasonId, viewer.season.id))
        .orderBy(asc(players.name)),
    ]);
    const flagged = rows.filter(
      (r) =>
        !r.checkin.flagsReviewed &&
        !r.checkin.rejected &&
        (r.checkin.autoClosed || r.checkin.flags.length > 0),
    );
    return { uke, week, rows, roster, flagged };
  });

export const Route = createFileRoute("/admin/oppmote/")({
  validateSearch: (search: Record<string, unknown>): { uke?: string } => ({
    uke: typeof search.uke === "string" ? search.uke : undefined,
  }),
  loaderDeps: ({ search }) => ({ uke: search.uke }),
  loader: ({ deps, location }) =>
    loadAttendanceAdmin({ data: deps.uke ?? "", headers: { "x-mv-path": location.href } }),
  component: AttendanceAdmin,
});

function AttendanceAdmin() {
  const { week, rows, roster, flagged } = Route.useLoaderData();
  const row = (c: (typeof rows)[number]) => (
    <li key={c.checkin.id} className="space-y-3 py-4 text-sm first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-white">{c.name}</span>
        <span className="text-zinc-400">
          {formatOslo(c.checkin.checkInAt)} –{" "}
          {c.checkin.checkOutAt ? formatOslo(c.checkin.checkOutAt, false) : "åpen"}
        </span>
        {c.checkin.autoClosed && !c.checkin.approved && <Badge tone="amber">Ikke sjekket ut</Badge>}
        {c.checkin.approved && <Badge tone="green">Godkjent</Badge>}
        {c.checkin.rejected && <Badge tone="red">Underkjent</Badge>}
        {c.checkin.flags.map((f) => (
          <Badge key={f} tone="amber">
            {f}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(["approve", "reject", "reviewed", "restore"] as const).map((kind) => (
          <ActionForm key={kind} action={editCheckinAction}>
            <input type="hidden" name="checkinId" value={c.checkin.id} />
            <input type="hidden" name="kind" value={kind} />
            <Button type="submit" variant="ghost" size="sm">
              {
                {
                  approve: "Godkjenn",
                  reject: "Underkjenn",
                  reviewed: "OK, sett som sett",
                  restore: "Nullstill",
                }[kind]
              }
            </Button>
          </ActionForm>
        ))}
        <ActionForm action={editCheckinAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="checkinId" value={c.checkin.id} />
          <input type="hidden" name="kind" value="times" />
          <DateTimePicker
            name="checkInAt"
            aria-label="Inn"
            defaultValue={osloInputValue(c.checkin.checkInAt)}
          />
          <DateTimePicker
            name="checkOutAt"
            aria-label="Ut"
            defaultValue={c.checkin.checkOutAt ? osloInputValue(c.checkin.checkOutAt) : ""}
          />
          <Button type="submit" variant="ghost" size="sm">
            Rett tider
          </Button>
        </ActionForm>
      </div>
    </li>
  );
  return (
    <div className="space-y-6">
      <PageTitle sub={`Uke fra ${formatOsloDate(week)}`}>Oppmøte</PageTitle>
      <div className="-mt-4 flex gap-2">
        <LinkButton href={`/admin/oppmote?uke=${addDays(week, -7)}`} variant="ghost" size="sm">
          ← Forrige uke
        </LinkButton>
        <LinkButton href={`/admin/oppmote?uke=${addDays(week, 7)}`} variant="ghost" size="sm">
          Neste uke →
        </LinkButton>
      </div>
      <Card title="Merket for gjennomgang">
        {flagged.length ? (
          <ul className="divide-y divide-white/5">{flagged.map(row)}</ul>
        ) : (
          <Empty>Ingen.</Empty>
        )}
      </Card>
      <Card title="Alle innsjekker">
        {rows.length ? (
          <ul className="divide-y divide-white/5">{rows.map(row)}</ul>
        ) : (
          <Empty>Ingen innsjekker denne uka.</Empty>
        )}
      </Card>
      <Card title="Legg inn oppmøte manuelt">
        <ActionForm action={addCheckinAction} className="flex flex-wrap items-end gap-3">
          <Field label="Deltaker">
            <select name="playerId" required className={`${inputBase} w-auto`}>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inn">
            <DateTimePicker name="checkInAt" required />
          </Field>
          <Field label="Ut">
            <DateTimePicker name="checkOutAt" required />
          </Field>
          <Button type="submit">Legg til</Button>
        </ActionForm>
      </Card>
    </div>
  );
}
