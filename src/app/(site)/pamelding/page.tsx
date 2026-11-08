import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { ActionForm } from "@/components/ActionForm";
import { BioFields } from "@/components/BioFields";
import { inputClass } from "@/components/styles";
import { Button, Card, Checkbox, Field, PageTitle } from "@/components/ui";
import { bioFromPhoton } from "@/game/bio";

import { signUpAction } from "../actions";
const loadSignup = createServerFn({ method: "GET" }).handler(async () => {
  const { getViewer } = await import("@/server/auth/session");
  const { redirectToLogin } = await import("@/lib/guard");
  const { signupOpen } = await import("@/server/season");
  const viewer = await getViewer();
  if (!viewer) return redirectToLogin();
  if (viewer.player) throw redirect({ to: "/profil", search: { pameldt: "1" } });
  return {
    user: viewer.user,
    isGamemaster: viewer.isGamemaster,
    open: !!viewer.season && signupOpen(viewer.season),
  };
});
function SignupPage() {
  const { user, isGamemaster, open } = Route.useLoaderData();
  if (!open) {
    return <PageTitle sub="Påmeldingen er ikke åpen nå.">Påmelding</PageTitle>;
  }
  if (isGamemaster) {
    return <PageTitle sub="Spillmestere kan ikke delta i samme sesong.">Påmelding</PageTitle>;
  }
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle>Påmelding</PageTitle>
      <ActionForm action={signUpAction} className="space-y-4">
        <Card title="Utseende">
          <p className="mb-4 text-sm text-zinc-400">
            Vises bare til den som har deg som offer, så de finner deg. Alle feltene er valgfrie, og
            du kan endre dem senere på profilen.
          </p>
          <BioFields values={bioFromPhoton(user)} />
        </Card>
        <Card title="Bilde">
          <div className="space-y-5">
            <p className="text-sm text-zinc-400">
              Vi bruker profilbildet ditt fra TIHLDE. Bruk helst et bilde der ansiktet vises tydelig
              og utildekket. Du kan laste opp et annet bilde her. Det lagres bare hos Mordvember og
              endrer ingenting i TIHLDE.
            </p>
            <Field
              label="Last opp et annet bilde (valgfritt)"
              hint="JPG, PNG eller WebP, maks 4 MB"
            >
              <input
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/webp"
                className={inputClass}
              />
            </Field>
            <Checkbox name="consent" required>
              Jeg godtar at navnet og bildet mitt vises for innloggede TIHLDE-medlemmer og på
              skjermen på kontoret mens spillet pågår, og at det slettes etter arrangementet.
            </Checkbox>
            <Button type="submit">Meld meg på</Button>
          </div>
        </Card>
      </ActionForm>
    </div>
  );
}

export const Route = createFileRoute("/(site)/pamelding/")({
  loader: ({ location }) => loadSignup({ headers: { "x-mv-path": location.href } }),
  component: SignupPage,
});
