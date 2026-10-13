import { ActionForm } from "@/components/ActionForm";
import { Button, Card, Empty, inputClass, PageTitle } from "@/components/ui";
import { guard } from "@/lib/guard";
import { listStaff } from "@/server/admin";
import { addStaffAction, removeStaffAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RolesAdmin() {
  const viewer = await guard("roles");
  const rows = await listStaff(viewer.season.id);
  return (
    <div className="space-y-4">
      <PageTitle sub="Spillmestere ser sirkelen. Arrangører godkjenner drap, oppmøte, bilder og spørsmål, men ser ikke hvem som har hvem.">Roller</PageTitle>
      <Card title="Legg til">
        <ActionForm action={addStaffAction} className="flex flex-wrap gap-2" resetOnSuccess>
          <input name="username" required placeholder="TIHLDE-brukernavn" className={`${inputClass} flex-1`} />
          <select name="role" className={`${inputClass} w-auto`}>
            <option value="organizer">Arrangør</option>
            <option value="gamemaster">Spillmester</option>
          </select>
          <Button type="submit">Legg til</Button>
        </ActionForm>
      </Card>
      <Card>
        {rows.length === 0 ? (
          <Empty>Ingen lagt til ennå. KoK-leder er spillmester automatisk.</Empty>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="text-white">{r.name ?? r.username}</span> <span className="text-zinc-500">{r.username}</span> ·{" "}
                  {r.role === "gamemaster" ? "Spillmester" : "Arrangør"}
                </span>
                <ActionForm action={removeStaffAction} confirm={`Fjerne ${r.username}?`}>
                  <input type="hidden" name="staffId" value={r.id} />
                  <Button type="submit" variant="ghost">Fjern</Button>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
