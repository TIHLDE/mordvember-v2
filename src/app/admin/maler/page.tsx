import { ActionForm } from "@/components/ActionForm";
import { Badge, Button, Card, Field, inputClass, PageTitle } from "@/components/ui";
import { guard } from "@/lib/guard";
import { templates } from "@/server/admin";
import { saveTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await guard("gamemaster");
  const rows = await templates();
  return (
    <div className="space-y-4">
      <PageTitle sub="Felter i doble klammer, for eksempel {{grunn}}, fylles inn automatisk. Tom linje gir nytt avsnitt.">E-postmaler</PageTitle>
      {rows.map((t) => (
        <Card key={t.key} title={t.label}>
          {t.custom && <Badge tone="amber">Endret</Badge>}
          <ActionForm action={saveTemplateAction} className="mt-2 space-y-2">
            <input type="hidden" name="key" value={t.key} />
            <Field label="Emne"><input name="subject" defaultValue={t.subject} className={inputClass} /></Field>
            <Field label="Tekst"><textarea name="body" rows={4} defaultValue={t.body} className={inputClass} /></Field>
            <div className="flex items-center gap-3">
              <Button type="submit">Lagre</Button>
              {t.custom && <label className="flex items-center gap-1 text-xs text-zinc-500"><input type="checkbox" name="reset" /> Tilbakestill til standard</label>}
            </div>
          </ActionForm>
        </Card>
      ))}
    </div>
  );
}
