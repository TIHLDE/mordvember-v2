import { NextResponse, type NextRequest } from "next/server";
import { PhotonUnauthorizedError } from "@/server/auth/photon";
import { AccessError, getViewer } from "@/server/auth/session";
import { GameError } from "@/server/game";
import { searchPhotonUsers } from "@/server/photon-users";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Logg inn" }, { status: 401 });
  try {
    const users = await searchPhotonUsers(viewer, request.nextUrl.searchParams.get("q") ?? "");
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof PhotonUnauthorizedError) {
      return NextResponse.json({ error: "Logg inn på nytt for å søke i Photon.", login: true }, { status: 401 });
    }
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof GameError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Brukersøket feilet", error);
    return NextResponse.json({ error: "Søket i Photon feilet. Prøv igjen." }, { status: 502 });
  }
}
