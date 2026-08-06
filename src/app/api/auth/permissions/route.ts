import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_TOKEN, fetchGroups, isIndexLeader } from "../photon";

export const dynamic = "force-dynamic";

/**
 * Appen trenger bare ett svar: får denne brukeren se admin-panelet?
 *
 * Lepton svarte med en tabell over alle Django-modeller og read/write per
 * modell. Photons rettigheter er navngitte strenger med scope, og ingenting i
 * denne appen brukte den tabellen til annet enn Index-sjekken.
 */
export async function GET() {
  const token = (await cookies()).get(ACCESS_TOKEN)?.value;

  if (!token) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }

  const groups = await fetchGroups(token);

  return NextResponse.json({
    isIndexLeader: isIndexLeader(groups),
    groups: groups.map((group) => ({
      id: group.slug,
      name: group.name,
      isLeader: group.membership?.role === "leader",
    })),
  });
}
