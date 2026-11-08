import { createFileRoute } from "@tanstack/react-router";

import { PhotonUnauthorizedError } from "@/server/auth/photon";
import { AccessError, getViewer } from "@/server/auth/session";
import { GameError } from "@/server/game";
import { searchPhotonUsers } from "@/server/photon-users";

async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Logg inn" }, { status: 401 });
  try {
    const users = await searchPhotonUsers(viewer, new URL(request.url).searchParams.get("q") ?? "");
    return Response.json({ users });
  } catch (error) {
    if (error instanceof PhotonUnauthorizedError) {
      return Response.json(
        { error: "Logg inn på nytt for å søke i Photon.", login: true },
        { status: 401 },
      );
    }
    if (error instanceof AccessError)
      return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof GameError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Brukersøket feilet", error);
    return Response.json({ error: "Søket i Photon feilet. Prøv igjen." }, { status: 502 });
  }
}

export const Route = createFileRoute("/api/brukersok")({
  server: { handlers: { GET: ({ request }) => GET(request) } },
});
