import { desc } from "drizzle-orm";
import { ActionForm } from "@/components/ActionForm";
import { DateField, DateTimePicker, TimeField } from "@/components/DateTimePicker";
import { NumberStepper } from "@/components/NumberStepper";
import { Badge, Button, Card, Checkbox, Field, inputBase, inputClass, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { seasons } from "@/db/schema";
import type { WeekRules } from "@/game/attendance";
import { addDays, formatOslo, formatOsloDate, osloTime, weekStartOf } from "@/game/time";
import { osloInputValue } from "@/lib/action";
import { guard } from "@/lib/guard";
import { PHASES, phaseLabel, rulesForWeek } from "@/server/season";
import {
  createSeasonAction,
  defaultRulesAction,
  deleteSeasonDataAction,
  milestonesAction,
  officeAction,
  revokeScreenAction,
  screenLinkAction,
  setPhaseAction,
  statsAction,
  updateBasicsAction,
  weekRulesAction,
} from "../actions";

export const dynamic = "force-dynamic";

function RuleFields({ rules }: { rules: WeekRules }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Field label="Dager"><NumberStepper name="days" min={0} max={5} defaultValue={rules.days} /></Field>
      <Field label="Timer"><NumberStepper name="hours" min={0} max={8} step={0.5} defaultValue={rules.hours} /></Field>
      <Field label="Drap"><NumberStepper name="killsRequired" min={0} max={20} defaultValue={rules.killsRequired} /></Field>
      <Field label="Fra"><TimeField name="windowStart" defaultValue={rules.windowStart} required /></Field>
      <Field label="Til"><TimeField name="windowEnd" defaultValue={rules.windowEnd} required /></Field>
    </div>
  );
}

export default async function SeasonAdmin() {
  const viewer = await guard("gamemaster");
  const season = viewer.season;
  const settings = season.settings;
  const thisWeek = weekStartOf(new Date());
  const startWeek = settings.info.startDate ? weekStartOf(osloTime(settings.info.startDate, "12:00")) : null;
  const firstWeek = startWeek && startWeek > thisWeek ? startWeek : thisWeek;
  const weeks = [firstWeek, addDays(firstWeek, 7), addDays(firstWeek, 14)];
  const weekLabel = (week: string) => {
    const number = startWeek ? Math.round((Date.parse(week) - Date.parse(startWeek)) / (7 * 864e5)) + 1 : null;
    return `${number ? `Uke ${number} · ` : "Uka fra "}${formatOsloDate(week)}`;
  };
  const weekRules = await Promise.all(weeks.map(async (w) => ({ week: w, rules: await rulesForWeek(season, w) })));
  const all = await db.select().from(seasons).orderBy(desc(seasons.createdAt));

  return (
    <div className="space-y-6">
      <PageTitle sub={`Fase: ${phaseLabel(season.phase)}`}>{season.name}</PageTitle>

      <Card title="Fase">
        <ol className="mb-5 flex flex-wrap gap-2 text-sm">
          {PHASES.map((p) => (
            <li key={p.key}>
              <Badge tone={p.key === season.phase ? "red" : "zinc"}>{p.label}</Badge>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          {season.phase === "setup" && <PhaseButton phase="signup" label="Åpne påmelding" />}
          {season.phase === "signup" && <PhaseButton phase="closed" label="Steng påmelding" />}
          {season.phase === "signup" && <PhaseButton phase="setup" label="Tilbake til oppsett" />}
          {season.phase === "closed" && <PhaseButton phase="signup" label="Åpne påmelding igjen" />}
          {season.phase === "closed" && <p className="text-sm text-zinc-400">Trekk sirkelen og start spillet under Sirkel.</p>}
          {season.phase === "running" && <PhaseButton phase="ended" label="Avslutt sesongen" />}
        </div>
      </Card>

      <Card title="Grunninfo">
        <ActionForm action={updateBasicsAction} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem_11rem]">
            <Field label="Navn"><input name="name" defaultValue={season.name} className={inputClass} /></Field>
            <Field label="Påmeldingsfrist" hint="Påmeldingen stenger automatisk.">
              <DateTimePicker name="signupDeadline" defaultValue={season.signupDeadline ? osloInputValue(season.signupDeadline) : ""} />
            </Field>
            <Field label="Spillstart" hint="Vises på forsiden. Ukereglene starter her.">
              <DateField name="startDate" defaultValue={settings.info.startDate ?? ""} />
            </Field>
          </div>
          <Field label="Regler" hint="Vises på forsiden."><textarea name="rulesText" rows={6} defaultValue={settings.info.rules} className={inputClass} /></Field>
          <Field label="Andre datoer" hint="Vises under reglene på forsiden, sammen med spillstart. Én dato per linje.">
            <textarea
              name="dates"
              rows={3}
              defaultValue={settings.info.dates}
              placeholder={"Fredag 13. november: første fredagsliste\nTorsdag 3. desember: finale og premieutdeling"}
              className={inputClass}
            />
          </Field>
          <Button type="submit">Lagre</Button>
        </ActionForm>
      </Card>

      <Card title="Ukeregler">
        <ActionForm action={defaultRulesAction} className="space-y-3">
          <p className="text-sm font-medium text-zinc-300">Standard for alle uker</p>
          <RuleFields rules={settings.defaultRules} />
          <Button type="submit">Lagre standard</Button>
        </ActionForm>
        <div className="mt-6 space-y-6">
          {weekRules.map(({ week, rules }) => (
            <ActionForm key={week} action={weekRulesAction} className="space-y-3 border-t border-white/5 pt-6">
              <input type="hidden" name="weekStart" value={week} />
              <p className="text-sm font-medium text-zinc-300 first-letter:uppercase">{weekLabel(week)}</p>
              <RuleFields rules={rules} />
              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" variant="ghost">Lagre for denne uka</Button>
                <Checkbox name="useDefault">Bruk standard</Checkbox>
              </div>
            </ActionForm>
          ))}
        </div>
      </Card>

      <Card title="Milepæler">
        <ActionForm action={milestonesAction} className="space-y-3">
          {settings.milestones.map((m) => (
            <div key={m.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/5 pb-3 text-sm last-of-type:border-0">
              <span className="w-full text-zinc-200 sm:w-48">{m.label}</span>
              {m.kind !== "winner" && (
                <input name={`value-${m.key}`} type="number" aria-label={m.label} defaultValue={m.value} className={`${inputBase} w-20`} />
              )}
              <span className="w-14 text-zinc-500">{m.kind === "percent" ? "% igjen" : m.kind === "count" ? "igjen" : ""}</span>
              <Checkbox name={`email-${m.key}`} defaultChecked={m.email}>E-post</Checkbox>
            </div>
          ))}
          <Button type="submit">Lagre</Button>
        </ActionForm>
      </Card>

      <Card title="Statistikk på tavla">
        <ActionForm action={statsAction} className="space-y-3">
          <Checkbox name="killsToday" defaultChecked={settings.stats.killsToday}>Drap i dag</Checkbox>
          <Checkbox name="sinceLastKill" defaultChecked={settings.stats.sinceLastKill}>Tid siden siste drap</Checkbox>
          <Checkbox name="topKillerToday" defaultChecked={settings.stats.topKillerToday}>Dagens morder</Checkbox>
          <Button type="submit">Lagre</Button>
        </ActionForm>
      </Card>

      <Card title="Kontorets posisjon">
        <p className="mb-4 text-sm text-zinc-400">Innsjekk lenger unna enn radiusen merkes for arrangørene. Tomme felt slår av avstandssjekken.</p>
        <ActionForm action={officeAction} className="grid gap-3 sm:grid-cols-3">
          <Field label="Breddegrad"><input name="lat" defaultValue={settings.office?.lat ?? ""} className={inputClass} /></Field>
          <Field label="Lengdegrad"><input name="lng" defaultValue={settings.office?.lng ?? ""} className={inputClass} /></Field>
          <Field label="Radius (m)"><input name="radius" defaultValue={settings.office?.radiusMeters ?? 300} className={inputClass} /></Field>
          <Button type="submit" className="w-fit sm:col-span-3">Lagre</Button>
        </ActionForm>
      </Card>

      <Card title="Skjermlenke for tavla">
        <p className="mb-4 text-sm text-zinc-400">
          {season.screenTokenCreatedAt ? `Aktiv lenke laget ${formatOslo(season.screenTokenCreatedAt)}.` : "Ingen aktiv lenke."}
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionForm action={screenLinkAction} confirm={season.screenTokenCreatedAt ? "Lage ny lenke? Den gamle slutter å virke." : undefined}>
            <Button type="submit">Lag ny lenke</Button>
          </ActionForm>
          {season.screenTokenCreatedAt && (
            <ActionForm action={revokeScreenAction} confirm="Trekke tilbake skjermlenken?">
              <Button type="submit" variant="ghost">Trekk tilbake</Button>
            </ActionForm>
          )}
        </div>
      </Card>

      <Card title="Ny sesong">
        <p className="mb-4 text-sm text-zinc-400">Oppretter en tom sesong. Den forrige slettes ikke. Spillmestere og arrangører følger med.</p>
        <ActionForm action={createSeasonAction} className="flex flex-wrap gap-2" confirm="Opprette ny sesong? Den blir gjeldende sesong.">
          <input name="name" required aria-label="Navn på ny sesong" placeholder="Mordvember 2027" className={`${inputClass} min-w-48 flex-1`} />
          <Button type="submit">Opprett</Button>
        </ActionForm>
      </Card>

      <Card title="Slett sesongdata">
        <p className="mb-4 text-sm text-zinc-400">
          Fjerner bilder, navn, sirkel, drap, oppmøte og spørsmål. Igjen står antall deltakere, antall drap og varighet. Vinneren beholdes bare
          med samtykke.
        </p>
        <ul className="space-y-3">
          {all.filter((s) => s.phase === "ended").map((s) => (
            <li key={s.id} className="text-sm">
              {s.dataDeletedAt ? (
                <span className="text-zinc-500">
                  {s.name}: slettet. {s.summary ? `${s.summary.participants} deltakere, ${s.summary.kills} drap, ${s.summary.durationDays} dager.` : ""}{" "}
                  {s.winnerName ? `Vinner: ${s.winnerName}` : ""}
                </span>
              ) : (
                <ActionForm action={deleteSeasonDataAction} className="flex flex-wrap gap-2" confirm={`Slette alle data for ${s.name}? Dette kan ikke angres.`}>
                  <input type="hidden" name="seasonId" value={s.id} />
                  <input name="confirm" required aria-label="Bekreft sesongnavn" placeholder={`Skriv «${s.name}»`} className={`${inputClass} min-w-48 flex-1`} />
                  <Button type="submit" variant="danger">Slett data for {s.name}</Button>
                </ActionForm>
              )}
            </li>
          ))}
          {!all.some((s) => s.phase === "ended") && <li className="text-sm text-zinc-500">Ingen avsluttede sesonger.</li>}
        </ul>
      </Card>
    </div>
  );
}

function PhaseButton({ phase, label }: { phase: string; label: string }) {
  return (
    <ActionForm action={setPhaseAction} confirm={`${label}?`}>
      <input type="hidden" name="phase" value={phase} />
      <Button type="submit" variant="ghost">{label}</Button>
    </ActionForm>
  );
}
