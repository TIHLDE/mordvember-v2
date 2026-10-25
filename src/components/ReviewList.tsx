import Link from "next/link";
import type { ReviewItem } from "@/game/review";
import { Badge } from "./ui";

export function ReviewList({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) return <p className="text-sm text-zinc-400">Ingenting venter på godkjenning, og du trenger ikke gjøre noe.</p>;
  return (
    <ul className="divide-y divide-white/5 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
          <span className="flex min-w-0 items-start gap-2">
            {item.kind === "action" ? <Badge tone="red">Gjør noe</Badge> : <Badge tone="amber">Venter</Badge>}
            <span className="text-zinc-300">{item.text}</span>
          </span>
          {item.cta && (
            <Link href={item.href} className="shrink-0 font-medium text-blood hover:underline">
              {item.cta}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
