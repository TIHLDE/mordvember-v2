import type { GridPlayer } from "@/server/players";

export function PlayerGrid({ players, imageBase = "/api/bilde", large = false }: { players: GridPlayer[]; imageBase?: string; large?: boolean }) {
  return (
    <ul className={`grid gap-3 ${large ? "grid-cols-[repeat(auto-fill,minmax(120px,1fr))]" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6"}`}>
      {players.map((p) => (
        <li key={p.id} className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${imageBase}/${p.id}`}
            alt={p.name}
            loading="lazy"
            className={`aspect-square w-full rounded-lg border border-white/10 object-cover ${p.out ? "dead" : ""}`}
          />
          <p className={`mt-1 truncate text-xs ${p.out ? "text-zinc-600 line-through" : "text-zinc-200"}`}>{p.name}</p>
        </li>
      ))}
    </ul>
  );
}
