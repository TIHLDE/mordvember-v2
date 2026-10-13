import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { players, users } from "@/db/schema";
import { placeholderSvg, readImage } from "./images";

const HEADERS = { "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" };

function placeholder(name: string) {
  return new Response(placeholderSvg(name), { headers: { ...HEADERS, "Content-Type": "image/svg+xml" } });
}

export async function playerImageResponse(seasonId: string, playerId: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/i.test(playerId)) return new Response("Ikke funnet", { status: 404 });
  const [row] = await db
    .select({ player: players, photonImage: users.photonImage })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(and(eq(players.id, playerId), eq(players.seasonId, seasonId)));
  if (!row) return new Response("Ikke funnet", { status: 404 });
  const { player, photonImage } = row;
  if (player.imageDeleted || player.imageRejectedReason) return placeholder(player.name);
  if (!player.useDefaultImage && player.imageKey) {
    const image = await readImage(player.imageKey);
    if (image) return new Response(image.body, { headers: { ...HEADERS, "Content-Type": image.contentType } });
  }
  if (player.useDefaultImage && photonImage?.startsWith("https://")) {
    const upstream = await fetch(photonImage, { next: { revalidate: 3600 } }).catch(() => null);
    const type = upstream?.headers.get("content-type") ?? "";
    if (upstream?.ok && type.startsWith("image/") && !type.includes("svg")) {
      return new Response(upstream.body, { headers: { ...HEADERS, "Content-Type": type } });
    }
  }
  return placeholder(player.name);
}
