import { createServerFn } from "@tanstack/react-start";

export const getNavigation = createServerFn({ method: "GET" }).handler(async () => {
  const { getViewer } = await import("./auth/session");
  const { openKillsForPlayer } = await import("./game");
  const { db } = await import("@/db");
  const { notifications } = await import("@/db/schema");
  const { and, eq, isNull } = await import("drizzle-orm");
  const viewer = await getViewer();
  if (!viewer) return { viewer: null, unread: 0, waiting: false };
  const unread = await db.$count(
    notifications,
    and(eq(notifications.userId, viewer.user.id), isNull(notifications.readAt)),
  );
  const open =
    viewer.season && viewer.player
      ? await openKillsForPlayer(viewer.season.id, viewer.player.id)
      : [];
  const waiting = open.some(
    (kill) =>
      kill.status === "pending" &&
      (kill.reportedBy === "killer" ? kill.victimId : kill.killerId) === viewer.player?.id,
  );
  return {
    viewer: {
      user: { name: viewer.user.name, photonImage: viewer.user.photonImage },
      player: viewer.player ? { status: viewer.player.status } : null,
      season: viewer.season ? { phase: viewer.season.phase } : null,
      isGamemaster: viewer.isGamemaster,
      canManageRoles: viewer.canManageRoles,
    },
    unread,
    waiting,
  };
});
