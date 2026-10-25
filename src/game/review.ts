// What the gamemasters still have to look at for one contestant, and whether the contestant has to do anything.

export type ImageState = "deleted" | "rejected" | "approved" | "pending";

export function imageState(p: { imageApprovedAt: Date | null; imageRejectedReason: string | null; imageDeleted: boolean }): ImageState {
  if (p.imageDeleted) return "deleted";
  if (p.imageRejectedReason) return "rejected";
  if (p.imageApprovedAt) return "approved";
  return "pending";
}

export type ReviewItem = {
  text: string;
  // "action": the contestant must do something. "waiting": the gamemasters or the other party must.
  kind: "action" | "waiting";
  href: string;
  cta?: string;
};

export type ReviewInput = {
  playerId: string;
  alive: boolean;
  image: { imageApprovedAt: Date | null; imageRejectedReason: string | null; imageDeleted: boolean };
  kills: { status: string; reportedBy: "killer" | "victim"; killerId: string; victimId: string }[];
  unclosedCheckinDates: string[];
  pendingReviewWeeks: string[];
  formatDate: (date: string) => string;
};

export function reviewItems(input: ReviewInput): ReviewItem[] {
  const items: ReviewItem[] = [];
  const image = imageState(input.image);
  if (input.alive && image === "rejected") {
    items.push({ kind: "action", text: `Bildet ditt ble avvist: ${input.image.imageRejectedReason}`, href: "/profil", cta: "Last opp nytt bilde" });
  }
  if (input.alive && image === "pending") {
    items.push({ kind: "waiting", text: "Bildet ditt venter på godkjenning fra spillmesterne.", href: "/profil" });
  }
  for (const kill of input.kills) {
    const iConfirm = (kill.reportedBy === "killer" ? kill.victimId : kill.killerId) === input.playerId;
    if (kill.status === "escalated") {
      items.push({ kind: "waiting", text: "Et drap du er part i behandles av spillmesterne.", href: "/drap" });
    } else if (kill.status === "pending" && iConfirm) {
      items.push({ kind: "action", text: "Et drap du er part i venter på svar fra deg.", href: "/drap", cta: "Bekreft eller avvis" });
    } else if (kill.status === "pending") {
      items.push({ kind: "waiting", text: "Et drap du har meldt venter på bekreftelse fra den andre.", href: "/drap" });
    }
  }
  for (const date of input.unclosedCheckinDates) {
    items.push({
      kind: "waiting",
      text: `Du sjekket ikke ut ${input.formatDate(date)}. Den økta teller ikke før spillmesterne har godkjent den.`,
      href: "/oppmote",
    });
  }
  for (const week of input.pendingReviewWeeks) {
    items.push({ kind: "waiting", text: `Uka fra ${input.formatDate(week)} oppfylte ikke kravene og vurderes av spillmesterne.`, href: "/oppmote" });
  }
  // Things to act on first.
  return items.sort((a, b) => Number(b.kind === "action") - Number(a.kind === "action"));
}
