import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { BioFields } from "@/components/BioFields";
import { Button, Card, Checkbox, Field, inputClass, PageTitle } from "@/components/ui";
import { redirectToLogin } from "@/lib/guard";
import { getViewer } from "@/server/auth/session";
import { signupOpen } from "@/server/season";
import { signUpAction, wrongStudyAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const viewer = await getViewer();
  if (!viewer) return redirectToLogin();
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
      <PageTitle>Påmelding</PageTitle>
      <Card title="Dette henter vi fra TIHLDE">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-zinc-500">Navn</dt>
          <dd>{user.name}</dd>
          <dt className="text-zinc-500">Studieprogram</dt>
          <dd>{user.studyProgram ?? "Mangler"}</dd>
          <dt className="text-zinc-500">Kull</dt>
          <dd>{user.studyStartYear ?? "Mangler"}</dd>
        </dl>
        <ActionForm action={wrongStudyAction} className="mt-5">
          <Button variant="ghost" type="submit">Dette stemmer ikke</Button>
        </ActionForm>
      </Card>
      <ActionForm action={signUpAction} className="space-y-4">
        <Card title="Utseende">
          <p className="mb-4 text-sm text-zinc-400">
            Vises bare til den som har deg som offer, så de finner deg. Alle feltene er valgfrie, og du kan endre dem senere på profilen.
          </p>
          <BioFields values={{ study: user.studyProgram ?? "", year: user.classYear ? `${user.classYear}. klasse` : "" }} />
        </Card>
        <Card title="Bilde">
          <div className="space-y-5">
            <p className="text-sm text-zinc-400">
              Vi bruker profilbildet ditt fra TIHLDE. Bruk helst et bilde der ansiktet vises tydelig og utildekket. Du kan laste opp et annet
              bilde her. Det lagres bare hos Mordvember og endrer ingenting i TIHLDE.
            </p>
            <Field label="Last opp et annet bilde (valgfritt)" hint="JPG, PNG eller WebP, maks 5 MB">
              <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className={inputClass} />
            </Field>
            <Checkbox name="consent" required>
              Jeg godtar at navnet og bildet mitt vises for innloggede TIHLDE-medlemmer og på skjermen på kontoret mens spillet pågår, og at det
              slettes etter arrangementet.
            </Checkbox>
            <Button type="submit">Meld meg på</Button>
          </div>
        </Card>
      </ActionForm>
    </div>
  );
}
