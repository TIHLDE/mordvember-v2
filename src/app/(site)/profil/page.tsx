import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { BioFields } from "@/components/BioFields";
import { Portrait } from "@/components/Portrait";
import { Badge, Button, Card, Field, inputClass, Notice, PageTitle } from "@/components/ui";
import { parseBio } from "@/game/bio";
import { getViewer } from "@/server/auth/session";
import { signupOpen } from "@/server/season";
import {
  bioAction,
  defaultImageAction,
  deleteImageAction,
  uploadImageAction,
  withdrawAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ pameldt?: string }> }) {
  const { pameldt } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/profil");
  const { player, season } = viewer;
  if (!player || !season) redirect("/");
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle sub={`${player.name} · ${player.studyProgram ?? "Studieprogram mangler"}${player.studyStartYear ? ` · kull ${player.studyStartYear}` : ""}`}>
        Profil
      </PageTitle>
      {pameldt && <Notice tone="green">Du er påmeldt! Du får e-post når spillet starter.</Notice>}
      <Card title="Bilde">
        <div className="flex flex-col gap-5 sm:flex-row">
          <Portrait src={`/api/bilde/${player.id}?v=${player.imageKey ?? "standard"}`} alt="" className="size-36 shrink-0 rounded-xl border border-white/10 object-cover" />
          <div className="min-w-0 flex-1 space-y-4">
            {player.imageRejectedReason && (
              <Notice tone="red">Bildet ble avvist: {player.imageRejectedReason}</Notice>
            )}
            {player.imageDeleted ? (
              <Badge>Bildet er slettet</Badge>
            ) : (
              <p className="text-sm text-zinc-400">{player.useDefaultImage ? "Du bruker profilbildet fra TIHLDE." : "Du bruker et opplastet bilde."}</p>
            )}
            {player.status === "alive" && (
              <>
                <ActionForm action={uploadImageAction} className="space-y-3" resetOnSuccess>
                  <Field label="Last opp nytt bilde" hint="Ansiktet skal vises tydelig og utildekket. Maks 5 MB.">
                    <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required className={inputClass} />
                  </Field>
                  <Button type="submit">Last opp</Button>
                </ActionForm>
                {!player.useDefaultImage && (
                  <ActionForm action={defaultImageAction}>
                    <Button type="submit" variant="ghost">Bruk profilbildet fra TIHLDE</Button>
                  </ActionForm>
                )}
              </>
            )}
            {player.status !== "alive" && !player.imageDeleted && (
              <ActionForm action={deleteImageAction} confirm="Slette bildet ditt fra Mordvember?">
                <Button type="submit" variant="ghost">Slett bildet mitt</Button>
              </ActionForm>
            )}
          </div>
        </div>
      </Card>
      {player.status === "alive" && (
        <Card title="Utseende">
          <ActionForm action={bioAction} className="space-y-4">
            <p className="text-sm text-zinc-400">Vises bare til den som har deg som offer. La felt stå tomme hvis du ikke vil oppgi dem.</p>
            <BioFields values={parseBio(player.bio)} />
            <Button type="submit">Lagre</Button>
          </ActionForm>
        </Card>
      )}
      {signupOpen(season) && (
        <Card title="Avmelding">
          <ActionForm action={withdrawAction} confirm="Melde deg av Mordvember?">
            <Button type="submit" variant="danger">Meld meg av</Button>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
