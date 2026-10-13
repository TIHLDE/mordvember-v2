import Link from "next/link";
import { redirect } from "next/navigation";
import { LinkButton, PageTitle } from "@/components/ui";
import { safeNext } from "@/lib/redirect";
import { getViewer } from "@/server/auth/session";

const ERRORS: Record<string, string> = {
  kode: "Innloggingen ble avbrutt.",
  state: "Innloggingen kom ikke fra denne nettleseren. Prøv igjen.",
  photon: "Fikk ikke kontakt med TIHLDE-innloggingen. Prøv igjen om litt.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ feil?: string; next?: string }> }) {
  const { feil, next } = await searchParams;
  if (await getViewer()) redirect(safeNext(next));
  const target = safeNext(next);
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <PageTitle sub="Logg inn med TIHLDE-brukeren din for å se deltakerne og melde deg på.">Logg inn</PageTitle>
      {feil && <p className="mb-4 rounded bg-red-950 p-3 text-sm text-red-300">{ERRORS[feil] ?? "Innloggingen feilet."}</p>}
      <LinkButton href={`/api/auth/login?next=${encodeURIComponent(target)}`}>Logg inn med TIHLDE</LinkButton>
      {process.env.NODE_ENV === "development" && (
        <p className="mt-8 text-sm text-zinc-500">
          Lokal utvikling: <Link href={`/dev?next=${encodeURIComponent(target)}`} className="underline">velg testbruker</Link>
        </p>
      )}
    </div>
  );
}
