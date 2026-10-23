import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Button, Card, inputClass, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { players } from "@/db/schema";
import { guard } from "@/lib/guard";
import { approveImageAction, disqualifyAction, rejectImageAction, removePlayerAction } from "../../actions";
import { imageStatus, STATUS } from "../status";

export const dynamic = "force-dynamic";

export default async function PlayerAdmin({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await guard("gamemaster");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const player = await db.query.players.findFirst({ where: and(eq(players.id, id), eq(players.seasonId, viewer.season.id)) });
  if (!player) notFound();
  const image = imageStatus(player);
  const canDisqualify = player.status === "alive" && viewer.season.phase === "running";
  const canRemove = viewer.isGamemaster && viewer.season.phase !== "running" && viewer.season.phase !== "ended";

  return (
    <div className="space-y-6">
      <Link href="/admin/deltakere" className="inline-flex text-sm text-zinc-400 transition-colors hover:text-white">
        ← Alle deltakere
      </Link>
      <PageTitle
        sub={
          <>
            {player.studyProgram ?? "Studie mangler"}
            {player.studyStartYear ? ` · ${player.studyStartYear}` : ""} · <span className="tabular-nums">{player.killCount}</span> drap
          </>
        }
      >
        {player.name}
      </PageTitle>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card title="Bilde">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/bilde/${player.id}?v=${player.imageKey ?? "standard"}`}
            alt={player.name}
            className="mb-4 aspect-square w-full rounded-xl object-cover"
          />
          <p className="mb-4 flex flex-wrap gap-1">
            <Badge>{player.imageDeleted ? "Slettet" : player.useDefaultImage ? "TIHLDE-bilde" : "Opplastet"}</Badge>
            {image && <Badge tone={image.tone}>{image.label}</Badge>}
          </p>
          {player.imageRejectedReason && <p className="mb-4 text-sm text-zinc-400">Avvist: {player.imageRejectedReason}</p>}
          {!player.imageDeleted && (
            <div className="space-y-3">
              {!player.imageApprovedAt && (
                <ActionForm action={approveImageAction}>
                  <input type="hidden" name="playerId" value={player.id} />
                  <Button type="submit" variant="ghost" className="w-full">Godkjenn bildet</Button>
                </ActionForm>
              )}
              <ActionForm action={rejectImageAction} className="flex gap-2" resetOnSuccess>
                <input type="hidden" name="playerId" value={player.id} />
                <input name="message" required aria-label="Melding til deltakeren" placeholder="Kort melding" className={`${inputClass} min-w-0`} />
                <Button type="submit" variant="danger">Avvis</Button>
              </ActionForm>
              <p className="text-xs text-zinc-500">Avvis bilder der ansiktet ikke vises tydelig. Deltakeren får meldingen og kan laste opp nytt.</p>
            </div>
          )}
        </Card>

        <Card title="Status">
          <p className="mb-6">
            <Badge tone={STATUS[player.status][1]}>{STATUS[player.status][0]}</Badge>
          </p>
          {player.bio && <p className="mb-6 text-sm whitespace-pre-line text-zinc-300">{player.bio}</p>}
          {canDisqualify && (
            <ActionForm action={disqualifyAction} className="flex flex-wrap gap-2" confirm={`Diskvalifisere ${player.name}?`}>
              <input type="hidden" name="playerId" value={player.id} />
              <input name="reason" required aria-label="Begrunnelse" placeholder="Begrunnelse" className={`${inputClass} min-w-48 flex-1`} />
              <Button type="submit" variant="danger-ghost">Diskvalifiser</Button>
            </ActionForm>
          )}
          {canRemove && (
            <ActionForm action={removePlayerAction} confirm={`Fjerne ${player.name} fra sesongen?`}>
              <input type="hidden" name="playerId" value={player.id} />
              <Button type="submit" variant="ghost">Fjern fra sesongen</Button>
            </ActionForm>
          )}
          {!canDisqualify && !canRemove && <p className="text-sm text-zinc-500">Ingen handlinger tilgjengelig i denne fasen.</p>}
        </Card>
      </div>
    </div>
  );
}
