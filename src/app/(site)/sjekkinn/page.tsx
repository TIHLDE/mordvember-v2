import { cookies } from "next/headers";
import { PageTitle } from "@/components/ui";
import { redirectToLogin } from "@/lib/guard";
import { myAttendance, PENDING_SCAN_COOKIE, readPendingScan, SCAN_RESULT_COOKIE } from "@/server/attendance";
import { getViewer } from "@/server/auth/session";
import { completeScanAction } from "../actions";
import { CheckinButton } from "./CheckinButton";

export const dynamic = "force-dynamic";

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ feil?: string }> }) {
  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <PageTitle center>Oppmøte</PageTitle>
      <CheckinState searchParams={searchParams} />
    </div>
  );
}

async function CheckinState({ searchParams }: { searchParams: Promise<{ feil?: string }> }) {
  const [{ feil }, viewer, jar] = await Promise.all([searchParams, getViewer(), cookies()]);
  const season = viewer?.season;
  const pending = season ? readPendingScan(jar.get(PENDING_SCAN_COOKIE)?.value, season.id) : !!jar.get(PENDING_SCAN_COOKIE);

  if (feil === "kode" && !pending) return <p className="text-red-400">QR-koden er utløpt eller ugyldig. Skann på nytt.</p>;
  // A scanned code stays pending for ten minutes, so the check-in can be finished after logging in.
  if (!viewer) return redirectToLogin();
  if (!viewer.player) return <p className="text-zinc-400">Du er ikke påmeldt.</p>;
  if (!pending) {
    const done = jar.get(SCAN_RESULT_COOKIE)?.value;
    if (done) return <p className="success-pop font-display text-4xl text-emerald-400">{done === "in" ? "Du er sjekket inn" : "Du er sjekket ut"}</p>;
    return <p className="text-zinc-400">Skann QR-koden på statusskjermen for å sjekke inn eller ut.</p>;
  }
  const attendance = await myAttendance(viewer);
  return (
    <div className="space-y-4">
      <p className="text-zinc-300">{attendance?.open ? "Du er sjekket inn nå." : "Du er ikke sjekket inn."}</p>
      <CheckinButton intent={attendance?.open ? "out" : "in"} complete={completeScanAction} />
    </div>
  );
}
