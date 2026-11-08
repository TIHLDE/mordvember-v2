import { describe, expect, it } from "vite-plus/test";
import { imageState, reviewItems, type ReviewInput } from "./review";

const base: ReviewInput = {
  playerId: "me",
  alive: true,
  image: { imageApprovedAt: new Date(), imageRejectedReason: null, imageDeleted: false },
  kills: [],
  unclosedCheckinDates: [],
  pendingReviewWeeks: [],
  formatDate: (d) => d,
};

describe("status for deltakeren", () => {
  it("leser bildestatus", () => {
    expect(
      imageState({ imageApprovedAt: null, imageRejectedReason: null, imageDeleted: false }),
    ).toBe("pending");
    expect(
      imageState({ imageApprovedAt: null, imageRejectedReason: "uklart", imageDeleted: false }),
    ).toBe("rejected");
    expect(
      imageState({ imageApprovedAt: new Date(), imageRejectedReason: null, imageDeleted: false }),
    ).toBe("approved");
    expect(
      imageState({ imageApprovedAt: null, imageRejectedReason: "uklart", imageDeleted: true }),
    ).toBe("deleted");
  });

  it("har ingenting å vise når alt er godkjent", () => {
    expect(reviewItems(base)).toEqual([]);
  });

  it("ber om nytt bilde når det er avvist, og venter ellers", () => {
    const rejected = reviewItems({
      ...base,
      image: { imageApprovedAt: null, imageRejectedReason: "uklart", imageDeleted: false },
    });
    expect(rejected).toMatchObject([{ kind: "action", href: "/profil" }]);
    expect(rejected[0]!.text).toContain("uklart");
    const pending = reviewItems({
      ...base,
      image: { imageApprovedAt: null, imageRejectedReason: null, imageDeleted: false },
    });
    expect(pending).toMatchObject([{ kind: "waiting" }]);
  });

  it("skiller drap som venter på meg fra drap som venter på andre", () => {
    const items = reviewItems({
      ...base,
      kills: [
        { status: "pending", reportedBy: "killer", killerId: "me", victimId: "x" },
        { status: "pending", reportedBy: "killer", killerId: "y", victimId: "me" },
        { status: "escalated", reportedBy: "victim", killerId: "me", victimId: "z" },
      ],
    });
    expect(items.map((i) => i.kind)).toEqual(["action", "waiting", "waiting"]);
    expect(items[0]!.cta).toBe("Bekreft eller avvis");
  });

  it("viser glemt utsjekk og fredagsvurdering som ventende", () => {
    const items = reviewItems({
      ...base,
      unclosedCheckinDates: ["2026-10-20"],
      pendingReviewWeeks: ["2026-10-19"],
    });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.kind === "waiting" && i.href === "/oppmote")).toBe(true);
  });

  it("viser ikke bildestatus for den som er ute", () => {
    expect(
      reviewItems({
        ...base,
        alive: false,
        image: { imageApprovedAt: null, imageRejectedReason: null, imageDeleted: false },
      }),
    ).toEqual([]);
  });
});
