import type { GridPlayer } from "@/server/players";
import { Portrait } from "./Portrait";

export function PlayerGrid({ players, imageBase = "/api/bilde", large = false }: { players: GridPlayer[]; imageBase?: string; large?: boolean }) {
  return (
    <ul className={`grid gap-3 ${large ? "grid-cols-[repeat(auto-fill,minmax(120px,1fr))]" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6"}`}>
      {players.map((p) => (
        <li key={p.id} className="lift text-center">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
            <Portrait src={`${imageBase}/${p.id}`} alt={p.name} loading="lazy" className={`aspect-square w-full object-cover ${p.out ? "dead" : ""}`} />
          </div>
          <p className={`mt-1 truncate text-xs transition-colors duration-500 ${p.out ? "text-zinc-600 line-through" : "text-zinc-200"}`}>{p.name}</p>
        </li>
      ))}
    </ul>
  );
}
