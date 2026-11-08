import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { ActionForm } from "@/components/ActionForm";
import { inputClass } from "@/components/styles";
import { Badge, Button, Card, Checkbox, Field, PageTitle } from "@/components/ui";


import { saveTemplateAction } from "../actions";
function TemplatesPage() {
 const { rows } = Route.useLoaderData();
return (<div className="space-y-6">
      <PageTitle sub="Felter i doble klammer, for eksempel {{grunn}}, fylles inn automatisk. Tom linje gir nytt avsnitt.">E-postmaler</PageTitle>
      {rows.map((t) => (<Card key={t.key} title={t.label}>
          {t.custom && <p className="-mt-2 mb-4"><Badge tone="amber">Endret</Badge></p>}
          <ActionForm action={saveTemplateAction} className="space-y-4">
            <input type="hidden" name="key" value={t.key}/>
            <Field label="Emne"><input name="subject" defaultValue={t.subject} className={inputClass}/></Field>
            <Field label="Tekst"><textarea name="body" rows={5} defaultValue={t.body} className={inputClass}/></Field>
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit">Lagre</Button>
              {t.custom && <Checkbox name="restoreDefault">Tilbakestill til standard</Checkbox>}
            </div>
          </ActionForm>
        </Card>))}
    </div>);
}

export const Route = createFileRoute("/admin/maler/")({ loader: ({ location }) => loadTemplatesPage({ headers: { "x-mv-path": location.href } }), component: TemplatesPage });

const loadTemplatesPage = createServerFn({ method: "GET" }).handler(async () => {
const { guard } = await import("@/lib/guard");
const { templates } = await import("@/server/admin");
await guard("gamemaster");
const rows = await templates();
return { rows };
});
