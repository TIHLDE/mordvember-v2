import { createFileRoute } from "@tanstack/react-router";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/styles";
import { Notice, PageTitle } from "@/components/ui";
import { safeNext } from "@/lib/redirect";
import { getViewer } from "@/server/auth/session";
const ERRORS: Record<string, string> = {
    kode: "Innloggingen ble avbrutt.",
    state: "Innloggingen kom ikke fra denne nettleseren. Prøv igjen.",
    photon: "Fikk ikke kontakt med TIHLDE-innloggingen. Prøv igjen om litt.",
    lagring: "Innloggingen gikk gjennom, men vi fikk ikke lagret den. Prøv igjen om litt.",
    godkjenning: "TIHLDE-kontoen din venter på godkjenning fra en administrator. Du kan logge inn når den er godkjent.",
};
async function LoginPage() {
    const { feil, next } = await searchParams;
    if (await getViewer())
        redirect(safeNext(next));
    const target = safeNext(next);
    return (<div className="mx-auto max-w-md py-10 text-center">
      <PageTitle center sub="Logg inn med TIHLDE-brukeren din for å se deltakerne og melde deg på.">Logg inn</PageTitle>
      {feil && <div className="mb-6"><Notice tone="red">{ERRORS[feil] ?? "Innloggingen feilet."}</Notice></div>}
      {/* Not a next/link: its prefetch would run the login route and overwrite the OAuth cookie. */}
      <a href={`/api/auth/login?next=${encodeURIComponent(target)}`} className={buttonClass()}>Logg inn med TIHLDE</a>
      {process.env.NODE_ENV === "development" && (<p className="mt-8 text-sm text-zinc-500">
          Lokal utvikling: <Link href={`/dev?next=${encodeURIComponent(target)}`} className="underline">velg testbruker</Link>
        </p>)}
    </div>);
}

export const Route = createFileRoute("/(site)/login/")({ component: LoginPage });
