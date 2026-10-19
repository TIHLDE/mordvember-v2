import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Button, Card, Empty, inputClass, PageTitle } from "@/components/ui";
import { formatOslo } from "@/game/time";
import { getViewer } from "@/server/auth/session";
import { myQuestions } from "@/server/questions";
import { askAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/sporsmal");
  const mine = await myQuestions(viewer);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle sub={<>Svaret kommer privat til deg. Se også <Link href="/faq" className="underline">ofte stilte spørsmål</Link>.</>}>
        Spør spillmesterne
      </PageTitle>
      <Card>
        <ActionForm action={askAction} className="space-y-3" resetOnSuccess>
          <textarea name="question" aria-label="Spørsmål" required minLength={5} maxLength={2000} rows={4} className={inputClass} placeholder="Hva lurer du på?" />
          <Button type="submit">Send</Button>
        </ActionForm>
      </Card>
      <Card title="Dine spørsmål">
        {mine.length === 0 ? (
          <Empty>Du har ikke spurt om noe ennå.</Empty>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {mine.map((q) => (
              <li key={q.id} className="py-4 first:pt-0 last:pb-0">
                <p className="text-zinc-300">{q.question}</p>
                <p className="mt-1 text-xs text-zinc-500">{formatOslo(q.createdAt)}</p>
                {q.answer ? <p className="mt-3 border-l-2 border-blood pl-3 whitespace-pre-line text-white">{q.answer}</p> : <p className="mt-3 text-zinc-500">Ikke besvart ennå.</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
