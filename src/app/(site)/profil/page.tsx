import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Portrait } from "@/components/Portrait";
import { Badge, Button, Card, Field, inputClass, PageTitle } from "@/components/ui";
import { getViewer } from "@/server/auth/session";
import { signupOpen } from "@/server/season";
import {
  defaultImageAction,
  deleteImageAction,
  uploadImageAction,
  winnerConsentAction,
  withdrawAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ pameldt?: string }> }) {
  const { pameldt } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/profil");
  const { player, season } = viewer;
  if (!player || !season) redirect("/");
  const isWinner = season.winnerPlayerId === player.id;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle sub={`${player.name} · ${player.studyProgram ?? "Studieprogram mangler"}${player.studyStartYear ? ` · kull ${player.studyStartYear}` : ""}`}>
        Profil
      </PageTitle>
      {pameldt && <p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-300">Du er påmeldt! Du får e-post når spillet starter.</p>}
      <Card title="Bilde">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Portrait src={`/api/bilde/${player.id}?v=${player.imageKey ?? "standard"}`} alt="" className="h-36 w-36 rounded-lg object-cover" />
          <div className="flex-1 space-y-3">
            {player.imageRejectedReason && (
              <p className="rounded bg-red-950 p-2 text-sm text-red-300">Bildet ble avvist: {player.imageRejectedReason}</p>
            )}
            {player.imageDeleted ? (
              <Badge>Bildet er slettet</Badge>
            ) : (
              <p className="text-sm text-zinc-400">{player.useDefaultImage ? "Du bruker profilbildet fra TIHLDE." : "Du bruker et opplastet bilde."}</p>
            )}
            {player.status === "alive" && (
              <>
                <ActionForm action={uploadImageAction} className="space-y-2" resetOnSuccess>
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
      {isWinner && (
        <Card title="Du vant!">
          <ActionForm action={winnerConsentAction} className="space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="consent" defaultChecked={player.winnerConsent} className="mt-1" />
              Navnet mitt kan stå som vinner etter at sesongdata er slettet.
            </label>
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
