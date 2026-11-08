import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { ActionForm } from "@/components/ActionForm";
import { Button, Card, Empty, PageTitle } from "@/components/ui";
import { UserSearch } from "@/components/UserSearch";

import { addStaffAction, removeStaffAction } from "../actions";

const loadRolesAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { guard } = await import("@/lib/guard");
  const { listStaff } = await import("@/server/admin");
  const viewer = await guard("roles");
  const rows = await listStaff(viewer.season.id);
  return { rows };
});

export const Route = createFileRoute("/admin/roller/")({
  loader: ({ location }) => loadRolesAdmin({ headers: { "x-mv-path": location.href } }),
  component: RolesAdmin,
});

function RolesAdmin() {
  const { rows } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageTitle sub="Spillmestere styrer spillet og ser sirkelen.">Spillmestere</PageTitle>
      <Card title="Legg til">
        <p className="mb-4 text-sm text-zinc-400">
          Søk blant brukerne i Photon. Personen trenger ikke å ha logget inn i Mordvember først.
        </p>
        <ActionForm
          action={addStaffAction}
          className="flex flex-wrap items-start gap-2"
          resetOnSuccess
        >
          <UserSearch name="username" className="min-w-48 flex-1" />
          <Button type="submit">Legg til</Button>
        </ActionForm>
      </Card>
      <Card>
        {rows.length === 0 ? (
          <Empty>Ingen lagt til ennå. KoK-leder er spillmester automatisk.</Empty>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="min-w-0">
                  <span className="text-white">{r.name ?? r.username}</span>{" "}
                  <span className="text-zinc-500">{r.username}</span>
                </span>
                <ActionForm action={removeStaffAction} confirm={`Fjerne ${r.username}?`}>
                  <input type="hidden" name="staffId" value={r.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Fjern
                  </Button>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
