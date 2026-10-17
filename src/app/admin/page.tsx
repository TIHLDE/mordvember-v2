import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Button, Card, Field, inputClass, Notice, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { checkins, kills, players, questions, seasons } from "@/db/schema";
import { CONFIRM_TIMEOUT_MS } from "@/game/kills";
import { formatOslo } from "@/game/time";
import { msAgo } from "@/lib/time";
import { getViewer } from "@/server/auth/session";
import { phaseLabel } from "@/server/season";
import { pendingReviewCount } from "@/server/weekly";
import { createSeasonAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  const season = viewer.season;
  if (!season) {
    return (
      <div className="space-y-6">
        <PageTitle>Admin</PageTitle>
        <Card title="Opprett første sesong">
          <ActionForm action={createSeasonAction} className="space-y-4">
            <Field label="Navn">
              <input name="name" required className={inputClass} placeholder="Mordvember 2026" />
            </Field>
            <Button type="submit">Opprett</Button>
          </ActionForm>
        </Card>
      </div>
    );
  }
  const [total, alive, openCases, overdue, reviews, unanswered, flagged] = await Promise.all([
    db.$count(players, eq(players.seasonId, season.id)),
    db.$count(players, and(eq(players.seasonId, season.id), eq(players.status, "alive"))),
    db.$count(kills, and(eq(kills.seasonId, season.id), eq(kills.status, "escalated"))),
    db.$count(kills, and(eq(kills.seasonId, season.id), eq(kills.status, "pending"), lte(kills.reportedAt, msAgo(CONFIRM_TIMEOUT_MS)))),
    pendingReviewCount(season.id),
    db.$count(questions, and(eq(questions.seasonId, season.id), isNull(questions.answer))),
    db.$count(checkins, and(eq(checkins.seasonId, season.id), eq(checkins.flagsReviewed, false), eq(checkins.rejected, false), or(eq(checkins.autoClosed, true), sql`${checkins.flags} <> '[]'::jsonb`))),
  ]);
  const needsDeletion = viewer.isGamemaster
    ? await db.select().from(seasons).where(and(eq(seasons.phase, "ended"), isNull(seasons.dataDeletedAt), lte(seasons.endedAt, msAgo(30 * 86400_000))))
    : [];

  const items = [
    { label: "Drapssaker til avgjørelse", value: openCases + overdue, href: "/admin/drap" },
    { label: "Fredagslista, ikke avgjort", value: reviews, href: "/admin/fredag" },
    { label: "Ubesvarte spørsmål", value: unanswered, href: "/admin/sporsmal" },
    { label: "Merkede innsjekker", value: flagged, href: "/admin/oppmote" },
  ];

  return (
    <div className="space-y-6">
      <PageTitle sub={`${season.name} · ${phaseLabel(season.phase)}`}>Admin</PageTitle>
      {needsDeletion.map((s) => (
        <Notice key={s.id} tone="amber">
          {s.name} ble avsluttet {s.endedAt ? formatOslo(s.endedAt) : ""}. Husk å <Link href="/admin/sesong" className="underline">slette sesongdata</Link>.
        </Notice>
      ))}
      {viewer.emergencyUntil && (
        <Notice tone="red">Nødtilgang er aktiv til {formatOslo(viewer.emergencyUntil)}.</Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-zinc-400">Deltakere</p>
          <p className="mt-2 text-3xl font-semibold text-white tabular-nums">{total}</p>
          <p className="mt-1 text-sm text-zinc-500">{alive} med i spillet</p>
        </Card>
        {viewer.isStaff &&
          items.map((i) => (
            <Link key={i.href} href={i.href} className="group rounded-2xl">
              <Card className="h-full transition-colors duration-150 group-hover:border-white/25 group-hover:bg-white/[0.05]">
                <p className="text-sm text-zinc-400">{i.label}</p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${i.value ? "text-blood-light" : "text-white"}`}>{i.value}</p>
              </Card>
            </Link>
          ))}
      </div>
      {!viewer.isStaff && <p className="text-sm text-zinc-400">Du kan legge til og fjerne spillmestere og arrangører under Roller.</p>}
    </div>
  );
}
