import { asc, eq } from "drizzle-orm";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Button, Card, inputClass, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { players } from "@/db/schema";
import { guard } from "@/lib/guard";
import { approveImageAction, rejectImageAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ImagesAdmin() {
  const viewer = await guard("staff");
  const rows = await db.select().from(players).where(eq(players.seasonId, viewer.season.id)).orderBy(asc(players.imageApprovedAt), asc(players.name));
  return (
    <div className="space-y-4">
      <PageTitle sub="Avvis bilder der ansiktet ikke vises tydelig. Deltakeren får en melding og kan laste opp nytt.">Bilder</PageTitle>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <li key={p.id}>
            <Card>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/bilde/${p.id}?v=${p.imageKey ?? "standard"}`} alt={p.name} className="mb-2 aspect-square w-full rounded object-cover" />
              <p className="font-medium text-white">{p.name}</p>
              <p className="mb-2 flex flex-wrap gap-1">
                {p.useDefaultImage ? <Badge>TIHLDE-bilde</Badge> : <Badge>Opplastet</Badge>}
                {p.imageApprovedAt && <Badge tone="green">Godkjent</Badge>}
                {p.imageRejectedReason && <Badge tone="red">Avvist</Badge>}
              </p>
              {!p.imageApprovedAt && (
                <ActionForm action={approveImageAction} className="mb-2">
                  <input type="hidden" name="playerId" value={p.id} />
                  <Button type="submit" variant="ghost">Godkjenn</Button>
                </ActionForm>
              )}
              <ActionForm action={rejectImageAction} className="flex gap-2">
                <input type="hidden" name="playerId" value={p.id} />
                <input name="message" required placeholder="Kort melding" className={inputClass} />
                <Button type="submit" variant="danger">Avvis</Button>
              </ActionForm>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
