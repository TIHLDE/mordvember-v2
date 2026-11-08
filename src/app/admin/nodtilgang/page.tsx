import { createFileRoute } from "@tanstack/react-router";
import { ActionForm } from "@/components/ActionForm";
import { inputClass } from "@/components/styles";
import { Button, Card, PageTitle } from "@/components/ui";
import { formatOslo } from "@/game/time";
import { guard } from "@/lib/guard";
import { emergencyEndAction, emergencyStartAction } from "../actions";
export const dynamic = "force-dynamic";
async function EmergencyPage() {
    const viewer = await guard("index");
    return (<div className="max-w-xl space-y-6">
      <PageTitle sub="Gir innsyn i sirkelen i én time. Krever begrunnelse, logges, og spillmesterne varsles på e-post.">Nødtilgang</PageTitle>
      <Card>
        {viewer.emergencyUntil ? (<div className="space-y-4">
            <p className="text-red-300">Nødtilgang er aktiv til {formatOslo(viewer.emergencyUntil)}.</p>
            <ActionForm action={emergencyEndAction}>
              <Button type="submit" variant="ghost">Slå av nå</Button>
            </ActionForm>
          </div>) : (<ActionForm action={emergencyStartAction} className="space-y-4" confirm="Slå på nødtilgang? Spillmesterne får beskjed.">
            <textarea name="reason" aria-label="Begrunnelse" required minLength={10} rows={3} placeholder="Hvorfor trengs nødtilgang?" className={inputClass}/>
            <Button type="submit" variant="danger">Slå på nødtilgang</Button>
          </ActionForm>)}
      </Card>
    </div>);
}

export const Route = createFileRoute("/admin/nodtilgang/")({ component: EmergencyPage });
