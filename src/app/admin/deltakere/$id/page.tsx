import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { notFound } from "@tanstack/react-router";

import { ActionForm } from "@/components/ActionForm";
import { BioFields } from "@/components/BioFields";
import { inputClass } from "@/components/styles";
import { Badge, Button, Card, Field, PageTitle } from "@/components/ui";


import { parseBio } from "@/game/bio";

import { approveImageAction, disqualifyAction, playerBioAction, playerImageAction, rejectImageAction, removePlayerAction, } from "../../actions";
import { imageStatus, STATUS } from "../status";
function PlayerAdmin() {
 const { viewer, id, player, canDisqualify, canRemove, canEdit } = Route.useLoaderData();
return (<div className="space-y-6">
      <Link to="/admin/deltakere" className="inline-flex text-sm text-zinc-400 transition-colors hover:text-white">
        ← Alle deltakere
      </Link>
      <PageTitle sub={<>
            {player.studyProgram ?? "Studie mangler"}
            {player.studyStartYear ? ` · ${player.studyStartYear}` : ""} · <span className="tabular-nums">{player.killCount}</span> drap
          </>}>
        {player.name}
      </PageTitle>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <ImageReview player={player} canEdit={canEdit}/>

        <Card title="Status">
          <p className="mb-6">
            <Badge tone={STATUS[player.status][1]}>{STATUS[player.status][0]}</Badge>
          </p>
          {!canEdit && player.bio && <p className="mb-6 text-sm whitespace-pre-line text-zinc-300">{player.bio}</p>}
          {canDisqualify && (<ActionForm action={disqualifyAction} className="flex flex-wrap gap-2" confirm={`Diskvalifisere ${player.name}?`}>
              <input type="hidden" name="playerId" value={player.id}/>
              <input name="reason" required aria-label="Begrunnelse" placeholder="Begrunnelse" className={`${inputClass} min-w-48 flex-1`}/>
              <Button type="submit" variant="danger-ghost">Diskvalifiser</Button>
            </ActionForm>)}
          {canRemove && (<ActionForm action={removePlayerAction} confirm={`Fjerne ${player.name} fra sesongen?`}>
              <input type="hidden" name="playerId" value={player.id}/>
              <Button type="submit" variant="ghost">Fjern fra sesongen</Button>
            </ActionForm>)}
          {!canDisqualify && !canRemove && <p className="text-sm text-zinc-500">Ingen handlinger tilgjengelig i denne fasen.</p>}
        </Card>
      </div>

      {canEdit && (<Card title="Utseende">
          <ActionForm action={playerBioAction} className="space-y-4" resetOnSuccess>
            <input type="hidden" name="playerId" value={player.id}/>
            <p className="text-sm text-zinc-400">Vises til den som har deltakeren som offer.</p>
            <BioFields values={parseBio(player.bio)}/>
            <Button type="submit">Lagre utseende</Button>
          </ActionForm>
        </Card>)}
    </div>);
}
// The photo with its approval state, and the controls to approve or reject it.
function ImageReview({ player, canEdit }: {
    player: Awaited<ReturnType<typeof loadPlayerAdmin>>["player"];
    canEdit: boolean;
}) {
    const image = imageStatus(player);
    return (<Card title="Bilde">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/bilde/${player.id}?v=${player.imageKey ?? "standard"}`} alt={player.name} className="mb-4 aspect-square w-full rounded-xl object-cover"/>
      <p className="mb-4 flex flex-wrap gap-1">
        <Badge>{player.imageDeleted ? "Slettet" : player.useDefaultImage ? "TIHLDE-bilde" : "Opplastet"}</Badge>
        {image && <Badge tone={image.tone}>{image.label}</Badge>}
      </p>
      {player.imageRejectedReason && <p className="mb-4 text-sm text-zinc-400">Avvist: {player.imageRejectedReason}</p>}
      {!player.imageDeleted && (<div className="space-y-3">
          {!player.imageApprovedAt && (<ActionForm action={approveImageAction}>
              <input type="hidden" name="playerId" value={player.id}/>
              <Button type="submit" variant="ghost" className="w-full">Godkjenn bildet</Button>
            </ActionForm>)}
          <ActionForm action={rejectImageAction} className="flex gap-2" resetOnSuccess>
            <input type="hidden" name="playerId" value={player.id}/>
            <input name="message" required aria-label="Melding til deltakeren" placeholder="Kort melding" className={`${inputClass} min-w-0`}/>
            <Button type="submit" variant="danger">Avvis</Button>
          </ActionForm>
          <p className="text-xs text-zinc-500">Avvis bilder der ansiktet ikke vises tydelig. Deltakeren får meldingen og kan laste opp nytt.</p>
        </div>)}
      {canEdit && (<ActionForm action={playerImageAction} className="mt-6 space-y-3 border-t border-white/10 pt-6" resetOnSuccess>
          <input type="hidden" name="playerId" value={player.id}/>
          <Field label="Last opp bilde for deltakeren" hint="JPG, PNG eller WebP, maks 4 MB. Bildet godkjennes med en gang.">
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required className={inputClass}/>
          </Field>
          <Button type="submit" variant="ghost" className="w-full">Last opp bilde</Button>
        </ActionForm>)}
    </Card>);
}

export const Route = createFileRoute("/admin/deltakere/$id/")({ loader: ({ params }) => loadPlayerAdmin({ data: params.id }), component: PlayerAdmin });

const loadPlayerAdmin = createServerFn({ method: "GET" }).validator((value: unknown) => { if (typeof value !== "string") throw new Error("Ugyldig parameter"); return value; }).handler(async ({ data }) => {
const { and, eq } = await import("drizzle-orm");
const { db } = await import("@/db");
const { players } = await import("@/db/schema");
const { guard } = await import("@/lib/guard");
const viewer = await guard("gamemaster");
const { id } = { id: data };
if (!/^[0-9a-f-]{36}$/i.test(id))
        throw notFound();
const player = await db.query.players.findFirst({ where: and(eq(players.id, id), eq(players.seasonId, viewer.season.id)) });
if (!player)
        throw notFound();
const canDisqualify = player.status === "alive" && viewer.season.phase === "running";
const canRemove = viewer.isGamemaster && viewer.season.phase !== "running" && viewer.season.phase !== "ended";
const canEdit = player.status === "alive";
return { viewer, id, player, canDisqualify, canRemove, canEdit };
});
