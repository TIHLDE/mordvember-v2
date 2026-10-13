import { ActionForm } from "@/components/ActionForm";
import { Badge, Button, Card, Empty, inputClass, PageTitle } from "@/components/ui";
import { formatOslo } from "@/game/time";
import { guard } from "@/lib/guard";
import { inbox } from "@/server/questions";
import { answerAction, publishAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function QuestionsAdmin() {
  const viewer = await guard("staff");
  const rows = await inbox(viewer);
  return (
    <div className="space-y-4">
      <PageTitle sub="Svar går privat til den som spurte. Du kan publisere spørsmål og svar anonymt.">Spørsmål</PageTitle>
      {rows.length === 0 && <Empty>Ingen spørsmål.</Empty>}
      {rows.map(({ q, asker }) => (
        <Card key={q.id}>
          <p className="text-xs text-zinc-500">
            {asker} · {formatOslo(q.createdAt)} {q.answer ? <Badge tone="green">Besvart</Badge> : <Badge tone="amber">Ubesvart</Badge>}{" "}
            {q.published && <Badge>Publisert</Badge>}
          </p>
          <p className="my-2 whitespace-pre-line text-white">{q.question}</p>
          <ActionForm action={answerAction} className="space-y-2">
            <input type="hidden" name="id" value={q.id} />
            <textarea name="answer" defaultValue={q.answer ?? ""} required rows={3} className={inputClass} placeholder="Svar" />
            <Button type="submit">{q.answer ? "Oppdater svar" : "Send svar"}</Button>
          </ActionForm>
          {q.answer && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-zinc-400">Publiser anonymt</summary>
              <ActionForm action={publishAction} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={q.id} />
                <textarea name="publicQuestion" defaultValue={q.publicQuestion ?? q.question} rows={2} className={inputClass} />
                <textarea name="publicAnswer" defaultValue={q.publicAnswer ?? q.answer} rows={3} className={inputClass} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="published" defaultChecked={q.published} /> Vis på siden med ofte stilte spørsmål
                </label>
                <Button type="submit" variant="ghost">Lagre</Button>
              </ActionForm>
            </details>
          )}
        </Card>
      ))}
    </div>
  );
}
