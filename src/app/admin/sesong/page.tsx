import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ActionForm } from "@/components/ActionForm";
import { TimeField } from "@/components/DateTimePicker";
import { NumberStepper } from "@/components/NumberStepper";
import { OfficeFields } from "@/components/OfficeFields";
import { inputClass } from "@/components/styles";
import { Badge, Button, Card, Field, PageTitle } from "@/components/ui";
import { GLOSHAUGEN, type WeekRules } from "@/game/attendance";
import { weekStartOf } from "@/game/time";

import type { Season } from "@/server/auth/session";


import { ResetGameFields } from "./ResetGameFields";
import { officeAction, resetGameAction, rulesAction, resumeGameAction, setPhaseAction, startGameAction, updateBasicsAction, } from "../actions";
function RuleFields({ rules }: {
    rules: WeekRules;
}) {
    // The fields keep their own state, so remount them when the saved rules change.
    return (<div key={JSON.stringify(rules)} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Field label="Dager">
        <NumberStepper name="days" min={0} max={5} defaultValue={rules.days}/>
      </Field>
      <Field label="Timer">
        <NumberStepper name="hours" min={0} max={8} step={0.5} defaultValue={rules.hours}/>
      </Field>
      <Field label="Drap totalt">
        <NumberStepper name="killsRequired" min={0} max={20} defaultValue={rules.killsRequired}/>
      </Field>
      <Field label="Fra">
        <TimeField name="windowStart" defaultValue={rules.windowStart} required/>
      </Field>
      <Field label="Til">
        <TimeField name="windowEnd" defaultValue={rules.windowEnd} required/>
      </Field>
    </div>);
}
function SeasonAdmin() {
 const { viewer, season, settings, rules, ringDrawn, phase } = Route.useLoaderData();
return (<div className="space-y-6">
      <PageTitle sub={`Fase: ${phase}`}>{season.name}</PageTitle>

      <Card title="Styring">
        <div className="divide-y divide-white/5">
          <SignupControl phase={season.phase}/>
          <GameControl phase={season.phase} ringDrawn={ringDrawn}/>
        </div>
      </Card>

      <Card title="Grunninfo">
        <ActionForm action={updateBasicsAction} className="space-y-4">
          <Field label="Navn">
            <input name="name" defaultValue={season.name} className={inputClass}/>
          </Field>
          <Field label="Regler" hint="Vises på forsiden.">
            <textarea name="rulesText" rows={6} defaultValue={settings.info.rules} className={inputClass}/>
          </Field>
          <Button type="submit">Lagre</Button>
        </ActionForm>
      </Card>

      <Card title="Oppmøteregler">
        <p className="mb-4 text-sm text-zinc-400">
          {season.phase === "running" || season.phase === "ended"
            ? "Reglene gjelder hver uke. Endrer du dem nå, gjelder de nye reglene fra denne uka."
            : "Gjelder hver uke gjennom hele spillet."}
        </p>
        <ActionForm action={rulesAction} className="space-y-3">
          <RuleFields rules={rules}/>
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-zinc-400">
            <p>
              <strong className="text-zinc-200">Dager:</strong> Hvor mange dager spillerne må være
              på skolen hver uke. Bare mandag til fredag teller.
            </p>
            <p>
              <strong className="text-zinc-200">Timer:</strong> Hvor lenge de må være der hver dag,
              i én økt. Velger du {rules.hours} timer, må de være der i minst {rules.hours} timer i
              strekk. Flere korte økter på samme dag legges ikke sammen. Deltakerne må derfor være
              totalt {rules.days} * {rules.hours} = {rules.days * rules.hours} timer på skolen hver
              uke
            </p>
            <p>
              <strong className="text-zinc-200">Drap:</strong> Hvor mange bekreftede drap spillerne må ha totalt i
              spillet. Drap fra tidligere uker teller også når kravet økes. Dette kommer i tillegg
              til å være på skolen. Velger du 0, trenger de ikke å gjøre noen drap. Den automatiske
              fredagslista lages fredag kl. 16.00, så drap etter det teller bare på lister som lages
              senere. Saker som allerede står på lista, endres ikke.
            </p>
            <p>
              <strong className="text-zinc-200">Fra og Til:</strong> Bare tiden mellom disse
              klokkeslettene teller som oppmøte.
            </p>
            <br />
            <p>
              <strong className="text-zinc-200">Hvis du endrer reglene:</strong> De nye reglene
              påvirker ikke tidligere uker. Endrer du reglene midt i en uke, gjelder de hele den
              uka, også dagene som allerede har gått. Dvs at det anbefales å sette nye regler på
              mandager.
            </p>
          </div>
          <Button type="submit">Lagre</Button>
        </ActionForm>
      </Card>

      <Card title="Kontorets posisjon">
        <p className="mb-4 text-sm text-zinc-400">
          Innsjekk utenfor sirkelen avvises. Klikk i kartet for å flytte midtpunktet. Tomme felt
          bruker Gløshaugen.
        </p>
        <ActionForm action={officeAction} className="grid gap-3 sm:grid-cols-3">
          <OfficeFields office={settings.office ?? GLOSHAUGEN}/>
          <Button type="submit" className="w-fit sm:col-span-3">
            Lagre
          </Button>
        </ActionForm>
      </Card>

      <Card title="Nullstill">
        <p className="mb-4 text-sm text-zinc-400">
          Sletter alle deltakere, bilder, sirkelen, drap, oppmøte, spørsmål og loggen, og setter
          spillet tilbake til start. Regler, innstillinger og roller beholdes. Dette kan ikke
          angres.
        </p>
        {season.phase === "running" ? (<p className="text-sm text-zinc-500">Stopp spillet før du nullstiller.</p>) : (<ActionForm action={resetGameAction} className="flex flex-wrap gap-2" confirm="Nullstille spillet? Alle deltakere og spilldata slettes.">
            <ResetGameFields seasonName={season.name}/>
          </ActionForm>)}
      </Card>
    </div>);
}
type Phase = Season["phase"];
function SignupControl({ phase }: {
    phase: Phase;
}) {
    return (<div className="flex flex-wrap items-center justify-between gap-3 pb-4">
      <div className="flex items-center gap-3">
        <span className="w-24 text-sm text-zinc-300">Påmelding</span>
        <Badge tone={phase === "signup" ? "red" : "zinc"}>
          {phase === "signup" ? "Åpen" : "Stengt"}
        </Badge>
      </div>
      {(phase === "setup" || phase === "closed") && (<PhaseButton phase="signup" label="Åpne påmelding"/>)}
      {phase === "signup" && <PhaseButton phase="closed" label="Steng påmelding"/>}
    </div>);
}
const GAME_STATE: Record<Phase, string> = {
    setup: "Ikke startet",
    signup: "Ikke startet",
    closed: "Ikke startet",
    running: "Pågår",
    ended: "Stoppet",
};
function GameControl({ phase, ringDrawn }: {
    phase: Phase;
    ringDrawn: boolean;
}) {
    return (<div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <div className="flex items-center gap-3">
        <span className="w-24 text-sm text-zinc-300">Spillet</span>
        <Badge tone={phase === "running" ? "red" : "zinc"}>{GAME_STATE[phase]}</Badge>
      </div>
      <GameAction phase={phase} ringDrawn={ringDrawn}/>
    </div>);
}
// The next step for the game in this phase.
function GameAction({ phase, ringDrawn }: {
    phase: Phase;
    ringDrawn: boolean;
}) {
    switch (phase) {
        case "setup":
        case "signup":
            return <p className="text-sm text-zinc-400">Steng påmeldingen før du starter.</p>;
        case "closed":
            return ringDrawn ? (<ActionForm action={startGameAction} confirm="Starte spillet? Alle deltakere får e-post om første offer.">
          <Button type="submit">Start spillet</Button>
        </ActionForm>) : (<p className="text-sm text-zinc-400">
          Trekk sirkelen under{" "}
          <Link to="/admin/sirkel" className="underline">
            Sirkel
          </Link>{" "}
          før du starter.
        </p>);
        case "running":
            return <PhaseButton phase="ended" label="Stopp spillet"/>;
        case "ended":
            return (<ActionForm action={resumeGameAction} confirm="Starte spillet igjen?">
          <Button type="submit" variant="ghost">
            Start spillet igjen
          </Button>
        </ActionForm>);
    }
}
function PhaseButton({ phase, label }: {
    phase: string;
    label: string;
}) {
    return (<ActionForm action={setPhaseAction} confirm={`${label}?`}>
      <input type="hidden" name="phase" value={phase}/>
      <Button type="submit" variant="ghost">
        {label}
      </Button>
    </ActionForm>);
}

export const Route = createFileRoute("/admin/sesong/")({ loader: () => loadSeasonAdmin(), component: SeasonAdmin });

const loadSeasonAdmin = createServerFn({ method: "GET" }).handler(async () => {
const { guard } = await import("@/lib/guard");
const { hasRing } = await import("@/server/game");
const { phaseLabel, rulesForWeek } = await import("@/server/season");
const viewer = await guard("gamemaster");
const season = viewer.season;
const settings = season.settings;
const rules = await rulesForWeek(season, weekStartOf(new Date()));
const ringDrawn = season.phase === "closed" && (await hasRing(season.id));
return { viewer, season, settings, rules, ringDrawn, phase: phaseLabel(season.phase) };
});
