import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Button, Card, Field, inputClass, PageTitle } from "@/components/ui";
import { formatOslo } from "@/game/time";
import { getViewer } from "@/server/auth/session";
import { signupOpen } from "@/server/season";
import { signUpAction, wrongStudyAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/pamelding");
  const season = viewer.season;
  if (viewer.player) redirect("/profil?pameldt=1");
  if (!season || !signupOpen(season)) {
    return <PageTitle sub="Påmeldingen er ikke åpen nå.">Påmelding</PageTitle>;
  }
  if (viewer.isGamemaster) {
    return <PageTitle sub="Spillmestere kan ikke delta i samme sesong.">Påmelding</PageTitle>;
  }
  const user = viewer.user;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle sub={season.signupDeadline ? `Frist: ${formatOslo(season.signupDeadline)}` : undefined}>Påmelding</PageTitle>
      <Card title="Dette henter vi fra TIHLDE">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-zinc-500">Navn</dt>
          <dd>{user.name}</dd>
          <dt className="text-zinc-500">Studieprogram</dt>
          <dd>{user.studyProgram ?? "Mangler"}</dd>
          <dt className="text-zinc-500">Kull</dt>
          <dd>{user.studyStartYear ?? "Mangler"}</dd>
        </dl>
        <ActionForm action={wrongStudyAction} className="mt-3">
          <Button variant="ghost" type="submit">Dette stemmer ikke</Button>
        </ActionForm>
      </Card>
      <Card title="Bilde">
        <ActionForm action={signUpAction} className="space-y-4">
          <p className="text-sm text-zinc-400">
            Vi bruker profilbildet ditt fra TIHLDE. Bruk helst et bilde der ansiktet vises tydelig og utildekket. Du kan laste opp et annet
            bilde her. Det lagres bare hos Mordvember og endrer ingenting i TIHLDE.
          </p>
          <Field label="Last opp et annet bilde (valgfritt)" hint="JPG, PNG eller WebP, maks 5 MB">
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className={inputClass} />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>
              Jeg godtar at navnet og bildet mitt vises for innloggede TIHLDE-medlemmer og på skjermen på kontoret mens spillet pågår, og at
              det slettes etter arrangementet.
            </span>
          </label>
          <Button type="submit">Meld meg på</Button>
        </ActionForm>
      </Card>
    </div>
  );
}
