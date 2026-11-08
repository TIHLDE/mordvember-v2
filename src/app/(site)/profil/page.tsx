import { requireViewer } from "@/server/auth/session";
import { myReviewItems } from "@/server/review";
import { signupOpen } from "@/server/season";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { ActionForm } from "@/components/ActionForm";
import { BioFields } from "@/components/BioFields";
import { Portrait } from "@/components/Portrait";
import { ReviewList } from "@/components/ReviewList";
import { inputClass } from "@/components/styles";
import { Badge, Button, Card, Field, Notice, PageTitle } from "@/components/ui";
import { parseBio } from "@/game/bio";
import { imageState } from "@/game/review";

import {
  bioAction,
  defaultImageAction,
  deleteImageAction,
  uploadImageAction,
  withdrawAction,
} from "../actions";

const loadProfile = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = await requireViewer();
  const { player, season } = viewer;
  if (!player || !season) throw redirect({ to: "/" });
  return { player, items: await myReviewItems(viewer), canWithdraw: signupOpen(season) };
});

type Player = Awaited<ReturnType<typeof loadProfile>>["player"];

export const Route = createFileRoute("/(site)/profil/")({
  validateSearch: (search: Record<string, unknown>): { pameldt?: string } => ({
    pameldt: typeof search.pameldt === "string" ? search.pameldt : undefined,
  }),
  loader: () => loadProfile(),
  component: ProfilePage,
});

function ProfilePage() {
  const { pameldt } = Route.useSearch();
  const { player, items, canWithdraw } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle sub={player.name}>Profil</PageTitle>
      {pameldt && <Notice tone="green">Du er påmeldt! Du får e-post når spillet starter.</Notice>}
      <Card title="Status">
        <ReviewList items={items} />
      </Card>
      <ImageCard player={player} />
      {player.status === "alive" && (
        <Card title="Utseende">
          <ActionForm action={bioAction} className="space-y-4" resetOnSuccess>
            <p className="text-sm text-zinc-400">
              Vises bare til den som har deg som offer. La felt stå tomme hvis du ikke vil oppgi
              dem.
            </p>
            <BioFields values={parseBio(player.bio)} />
            <Button type="submit">Lagre</Button>
          </ActionForm>
        </Card>
      )}
      {canWithdraw && (
        <Card title="Avmelding">
          <ActionForm action={withdrawAction} confirm="Melde deg av Mordvember?">
            <Button type="submit" variant="danger">
              Meld meg av
            </Button>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

function ImageCard({ player }: { player: Player }) {
  const alive = player.status === "alive";
  return (
    <Card title="Bilde">
      <div className="flex flex-col gap-5 sm:flex-row">
        <Portrait
          src={`/api/bilde/${player.id}?v=${player.imageKey ?? "standard"}`}
          alt=""
          className="size-36 shrink-0 rounded-xl border border-white/10 object-cover"
        />
        <div className="min-w-0 flex-1 space-y-4">
          {player.imageRejectedReason && (
            <Notice tone="red">Bildet ble avvist: {player.imageRejectedReason}</Notice>
          )}
          {player.imageDeleted ? (
            <Badge>Bildet er slettet</Badge>
          ) : (
            <div className="space-y-2">
              <ImageBadge player={player} />
              <p className="text-sm text-zinc-400">
                {player.useDefaultImage
                  ? "Du bruker profilbildet fra TIHLDE."
                  : "Du bruker et opplastet bilde."}
              </p>
            </div>
          )}
          {alive && (
            <>
              <ActionForm action={uploadImageAction} className="space-y-3" resetOnSuccess>
                <Field
                  label="Last opp nytt bilde"
                  hint="Ansiktet skal vises tydelig og utildekket. Maks 4 MB."
                >
                  <input
                    type="file"
                    name="image"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    className={inputClass}
                  />
                </Field>
                <Button type="submit">Last opp</Button>
              </ActionForm>
              {!player.useDefaultImage && (
                <ActionForm action={defaultImageAction}>
                  <Button type="submit" variant="ghost">
                    Bruk profilbildet fra TIHLDE
                  </Button>
                </ActionForm>
              )}
            </>
          )}
          {!alive && !player.imageDeleted && (
            <ActionForm action={deleteImageAction} confirm="Slette bildet ditt fra Mordvember?">
              <Button type="submit" variant="ghost">
                Slett bildet mitt
              </Button>
            </ActionForm>
          )}
        </div>
      </div>
    </Card>
  );
}

function ImageBadge({ player }: { player: Player }) {
  const state = imageState(player);
  if (state === "approved") return <Badge tone="green">Godkjent</Badge>;
  // The rejection notice above already says why.
  if (state === "rejected") return null;
  return <Badge tone="amber">Venter på godkjenning</Badge>;
}
