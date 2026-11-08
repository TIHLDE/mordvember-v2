import "@tanstack/react-start/server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { players, users } from "@/db/schema";
import { placeholderSvg, readImage } from "./images";

const HEADERS = { "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" };

function image(body: BodyInit | null, contentType: string) {
  return new Response(body, { headers: { ...HEADERS, "Content-Type": contentType } });
}

const placeholder = (name: string) => image(placeholderSvg(name), "image/svg+xml");

export async function playerImageResponse(seasonId: string, playerId: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/i.test(playerId)) return new Response("Ikke funnet", { status: 404 });
  const [row] = await db
    .select({
      player: players,
      photonImage: users.photonImage,
      photonImageKey: users.photonImageKey,
    })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(and(eq(players.id, playerId), eq(players.seasonId, seasonId)));
  if (!row) return new Response("Ikke funnet", { status: 404 });
  const { player, photonImage, photonImageKey } = row;
  if (player.imageDeleted || player.imageRejectedReason) return placeholder(player.name);
  // An uploaded image, or the copy of the TIHLDE profile picture stored at login.
  const key = player.useDefaultImage ? photonImageKey : player.imageKey;
  const stored = key ? await readImage(key) : null;
  if (stored) return image(stored.body, stored.contentType);
  if (player.useDefaultImage && photonImage?.startsWith("https://")) {
    const upstream = await fetch(photonImage).catch(() => null);
    const type = upstream?.headers.get("content-type") ?? "";
    if (upstream?.ok && type.startsWith("image/") && !type.includes("svg"))
      return image(upstream.body, type);
  }
  return placeholder(player.name);
}
