import { ActionForm } from "@/components/ActionForm";
import { Badge, Button, Card, Checkbox, Empty, inputClass, PageTitle } from "@/components/ui";
import { formatOslo } from "@/game/time";
import { guard } from "@/lib/guard";
import { inbox } from "@/server/questions";
import { answerAction, deleteQuestionAction, publishAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function QuestionsAdmin() {
  const viewer = await guard("gamemaster");
  const rows = await inbox(viewer);
  return (
    <div className="space-y-6">
      <PageTitle sub="Spørsmål og svar vises uten navn for alle innloggede på spørsmålssiden. Du kan også publisere dem anonymt i ofte stilte spørsmål.">Spørsmål</PageTitle>
      {rows.length === 0 && <Empty>Ingen spørsmål.</Empty>}
      {rows.map(({ q, asker }) => (
        <Card key={q.id}>
          <p className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {asker} · {formatOslo(q.createdAt)} {q.answer ? <Badge tone="green">Besvart</Badge> : <Badge tone="amber">Ubesvart</Badge>}{" "}
            {q.published && <Badge>Publisert</Badge>}
          </p>
          <p className="mt-3 mb-4 whitespace-pre-line text-white">{q.question}</p>
          <ActionForm action={answerAction} className="space-y-3">
            <input type="hidden" name="id" value={q.id} />
            <textarea name="answer" aria-label="Svar" defaultValue={q.answer ?? ""} required rows={3} className={inputClass} placeholder="Svar" />
            <Button type="submit">{q.answer ? "Oppdater svar" : "Send svar"}</Button>
          </ActionForm>
          {q.answer && (
            <details className="group mt-5 border-t border-white/5 pt-4">
              <summary className="cursor-pointer text-sm text-zinc-400 transition-colors hover:text-white"><span className="mr-1.5 inline-block transition-transform duration-150 group-open:rotate-90">›</span>Publiser anonymt</summary>
              <ActionForm action={publishAction} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={q.id} />
                <textarea name="publicQuestion" aria-label="Offentlig spørsmål" defaultValue={q.publicQuestion ?? q.question} rows={2} className={inputClass} />
                <textarea name="publicAnswer" aria-label="Offentlig svar" defaultValue={q.publicAnswer ?? q.answer} rows={3} className={inputClass} />
                <Checkbox name="published" defaultChecked={q.published}>Vis på siden med ofte stilte spørsmål</Checkbox>
                <Button type="submit" variant="ghost">Lagre</Button>
              </ActionForm>
            </details>
          )}
          <ActionForm action={deleteQuestionAction} confirm="Slette spørsmålet? Dette kan ikke angres." className="mt-5 border-t border-white/5 pt-4">
            <input type="hidden" name="id" value={q.id} />
            <Button type="submit" variant="danger-ghost" size="sm">Slett spørsmål</Button>
          </ActionForm>
        </Card>
      ))}
    </div>
  );
}
