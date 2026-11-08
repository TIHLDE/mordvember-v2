import { redirectToLogin } from "@/lib/guard";
import { getViewer } from "@/server/auth/session";
import { seasonQuestions } from "@/server/questions";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { ActionForm } from "@/components/ActionForm";
import { inputClass } from "@/components/styles";
import { Badge, Button, Card, Empty, PageTitle } from "@/components/ui";
import { formatOslo } from "@/game/time";

import { deleteQuestionAction } from "../../admin/actions";
import { askAction } from "../actions";

const loadQuestionsPage = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = await getViewer();
  if (!viewer) return redirectToLogin();
  const all = await seasonQuestions(viewer);
  return { viewer, all };
});

export const Route = createFileRoute("/(site)/sporsmal/")({
  loader: ({ location }) => loadQuestionsPage({ headers: { "x-mv-path": location.href } }),
  component: QuestionsPage,
});

function QuestionsPage() {
  const { viewer, all } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle sub="Spørsmål og svar er synlige for alle innloggede, uten navn.">
        Spør spillmesterne
      </PageTitle>
      <Card>
        <ActionForm action={askAction} className="space-y-3" resetOnSuccess>
          <textarea
            name="question"
            aria-label="Spørsmål"
            required
            minLength={5}
            maxLength={2000}
            rows={4}
            className={inputClass}
            placeholder="Hva lurer du på?"
          />
          <Button type="submit">Send</Button>
        </ActionForm>
      </Card>
      <Card title="Spørsmål">
        {all.length === 0 ? (
          <Empty>Ingen har spurt om noe ennå.</Empty>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {all.map((q) => (
              <li key={q.id} className="py-4 first:pt-0 last:pb-0">
                <p className="whitespace-pre-line text-zinc-300">{q.question}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  {formatOslo(q.createdAt)} {q.mine && <Badge>Ditt spørsmål</Badge>}
                </p>
                {q.answer ? (
                  <p className="mt-3 border-l-2 border-blood pl-3 whitespace-pre-line text-white">
                    {q.answer}
                  </p>
                ) : (
                  <p className="mt-3 text-zinc-500">Ikke besvart ennå.</p>
                )}
                {viewer.isGamemaster && (
                  <ActionForm
                    action={deleteQuestionAction}
                    confirm="Slette spørsmålet?"
                    className="mt-3"
                  >
                    <input type="hidden" name="id" value={q.id} />
                    <Button type="submit" variant="danger-ghost" size="sm">
                      Slett
                    </Button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
