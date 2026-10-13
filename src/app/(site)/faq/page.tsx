import { Card, Empty, PageTitle } from "@/components/ui";
import { faq } from "@/server/questions";
import { getCurrentSeason } from "@/server/season";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const season = await getCurrentSeason();
  const items = season ? await faq(season.id) : [];
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>Ofte stilte spørsmål</PageTitle>
      <Card>
        {items.length === 0 ? (
          <Empty>Ingen publiserte spørsmål ennå.</Empty>
        ) : (
          <dl className="space-y-5">
            {items.map((q) => (
              <div key={q.id}>
                <dt className="font-medium text-white">{q.question}</dt>
                <dd className="mt-1 whitespace-pre-line text-sm text-zinc-300">{q.answer}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </div>
  );
}
