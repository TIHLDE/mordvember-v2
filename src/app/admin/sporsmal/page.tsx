import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { ActionForm } from "@/components/ActionForm";
import { inputClass } from "@/components/styles";
import { Badge, Button, Card, Empty, PageTitle } from "@/components/ui";
import { formatOslo } from "@/game/time";

import { answerAction, deleteQuestionAction } from "../actions";
function QuestionsAdmin() {
  const { rows } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageTitle sub="Spørsmål og svar vises uten navn for alle innloggede på spørsmålssiden.">
        Spørsmål
      </PageTitle>
      {rows.length === 0 && <Empty>Ingen spørsmål.</Empty>}
      {rows.map(({ q, asker }) => (
        <Card key={q.id}>
          <p className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {asker} · {formatOslo(q.createdAt)}{" "}
            {q.answer ? <Badge tone="green">Besvart</Badge> : <Badge tone="amber">Ubesvart</Badge>}
          </p>
          <p className="mt-3 mb-4 whitespace-pre-line text-white">{q.question}</p>
          <ActionForm action={answerAction} className="space-y-3">
            <input type="hidden" name="id" value={q.id} />
            <textarea
              name="answer"
              aria-label="Svar"
              defaultValue={q.answer ?? ""}
              required
              rows={3}
              className={inputClass}
              placeholder="Svar"
            />
            <Button type="submit">{q.answer ? "Oppdater svar" : "Send svar"}</Button>
          </ActionForm>
          <ActionForm
            action={deleteQuestionAction}
            confirm="Slette spørsmålet? Dette kan ikke angres."
            className="mt-5 border-t border-white/5 pt-4"
          >
            <input type="hidden" name="id" value={q.id} />
            <Button type="submit" variant="danger-ghost" size="sm">
              Slett spørsmål
            </Button>
          </ActionForm>
        </Card>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/admin/sporsmal/")({
  loader: ({ location }) => loadQuestionsAdmin({ headers: { "x-mv-path": location.href } }),
  component: QuestionsAdmin,
});

const loadQuestionsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { guard } = await import("@/lib/guard");
  const { inbox } = await import("@/server/questions");
  const viewer = await guard("gamemaster");
  const rows = await inbox(viewer);
  return { rows };
});
