import { cookies } from "next/headers";
import { LinkButton, PageTitle } from "@/components/ui";
import { PENDING_SCAN_COOKIE, readPendingScan, SCAN_RESULT_COOKIE } from "@/server/attendance";
import { getViewer } from "@/server/auth/session";
import { completeScanAction } from "../actions";
import { CompleteScan } from "./CompleteScan";

export const dynamic = "force-dynamic";

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ feil?: string }> }) {
  const { feil } = await searchParams;
  const viewer = await getViewer();
  const jar = await cookies();
  const season = viewer?.season;
  const done = jar.get(SCAN_RESULT_COOKIE)?.value;
  const pending = season ? readPendingScan(jar.get(PENDING_SCAN_COOKIE)?.value, season.id) : !!jar.get(PENDING_SCAN_COOKIE);

  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <PageTitle>Oppmøte</PageTitle>
      {feil === "kode" && !pending ? (
        <p className="text-red-400">QR-koden er utløpt eller ugyldig. Skann på nytt.</p>
      ) : !viewer ? (
        <div className="space-y-4">
          <p className="text-zinc-300">Koden er godkjent. Logg inn innen ti minutter for å fullføre.</p>
          <LinkButton href="/login?next=/sjekkinn">Logg inn</LinkButton>
        </div>
      ) : !viewer.player ? (
        <p className="text-zinc-400">Du er ikke påmeldt.</p>
      ) : !pending && done ? (
        <p className="font-display text-4xl text-emerald-400">{done === "in" ? "Du er sjekket inn" : "Du er sjekket ut"}</p>
      ) : !pending ? (
        <p className="text-zinc-400">Skann QR-koden på tavla for å sjekke inn eller ut.</p>
      ) : (
        <CompleteScan complete={completeScanAction} />
      )}
    </div>
  );
}
