export const STATUS = { alive: ["Med", "green"], eliminated: ["Eliminert", "zinc"], disqualified: ["Diskvalifisert", "red"] } as const;

export function imageStatus(p: { imageApprovedAt: Date | null; imageRejectedReason: string | null; imageDeleted: boolean }) {
  if (p.imageDeleted) return null;
  if (p.imageRejectedReason) return { label: "Bilde avvist", tone: "red" } as const;
  if (p.imageApprovedAt) return { label: "Bilde godkjent", tone: "green" } as const;
  return { label: "Bilde venter", tone: "amber" } as const;
}
