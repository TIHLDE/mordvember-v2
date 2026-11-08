import { getViewer } from "@/server/auth/session";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { buttonClass } from "@/components/styles";
import { Notice, PageTitle } from "@/components/ui";
import { safeNext } from "@/lib/redirect";

const ERRORS: Record<string, string> = {
  kode: "Innloggingen ble avbrutt.",
  state: "Innloggingen kom ikke fra denne nettleseren. Prøv igjen.",
  photon: "Fikk ikke kontakt med TIHLDE-innloggingen. Prøv igjen om litt.",
  lagring: "Innloggingen gikk gjennom, men vi fikk ikke lagret den. Prøv igjen om litt.",
  godkjenning:
    "TIHLDE-kontoen din venter på godkjenning fra en administrator. Du kan logge inn når den er godkjent.",
};

const checkLogin = createServerFn({ method: "GET" })
  .validator((value: unknown) => (typeof value === "string" ? safeNext(value) : "/"))
  .handler(async ({ data }) => {
    if (await getViewer()) throw redirect({ href: data });
  });

export const Route = createFileRoute("/(site)/login/")({
  validateSearch: (search: Record<string, unknown>): { feil?: string; next?: string } => ({
    feil: typeof search.feil === "string" ? search.feil : undefined,
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  loaderDeps: ({ search }) => ({ next: search.next }),
  loader: ({ deps, location }) =>
    checkLogin({ data: deps.next ?? "/", headers: { "x-mv-path": location.href } }),
  component: LoginPage,
});

function LoginPage() {
  const { feil, next } = Route.useSearch();
  const target = safeNext(next);
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <PageTitle center sub="Logg inn med TIHLDE-brukeren din for å se deltakerne og melde deg på.">
        Logg inn
      </PageTitle>
      {feil && (
        <div className="mb-6">
          <Notice tone="red">{ERRORS[feil] ?? "Innloggingen feilet."}</Notice>
        </div>
      )}
      {/* Not a next/link: its prefetch would run the login route and overwrite the OAuth cookie. */}
      <a href={`/api/auth/login?next=${encodeURIComponent(target)}`} className={buttonClass()}>
        Logg inn med TIHLDE
      </a>
      {process.env.NODE_ENV === "development" && (
        <p className="mt-8 text-sm text-zinc-500">
          Lokal utvikling:{" "}
          <Link to="/dev" search={{ next: target }} className="underline">
            velg testbruker
          </Link>
        </p>
      )}
    </div>
  );
}
