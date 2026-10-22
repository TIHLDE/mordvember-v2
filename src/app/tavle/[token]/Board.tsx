"use client";

import { Portrait } from "@/components/Portrait";
import { Announcement, BoardMessage, boardImage, ScanToasts, since, useBoard, useNow } from "@/components/BoardLive";

export function Board({ token }: { token: string }) {
  const api = `/api/tavle/${token}`;
  const { data, live, shown, error } = useBoard(api);
  const now = useNow(30_000);

  if (error) return <BoardMessage>{error}</BoardMessage>;
  if (!data) return <BoardMessage>Laster …</BoardMessage>;

  const img = (id: string) => boardImage(api, id);

  return (
    <div className="flex min-h-dvh gap-6 p-6">
      <main className="flex-1">
        <header className="mb-6 flex items-end justify-between">
          <h1 className="font-display text-6xl text-blood">Mordvember</h1>
          <div className="text-right">
            <p className="font-display text-7xl leading-none text-white">
              <span key={data.alive} className="count-change">{data.alive}</span>
            </p>
            <p className="text-zinc-400">spillere igjen</p>
          </div>
        </header>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
          {data.players.map((p) => (
            <li key={p.id} className="text-center">
              <Portrait src={img(p.id)} alt="" className={`aspect-square w-full rounded-lg object-cover ${p.out ? "dead" : ""}`} />
              <p className={`mt-1 truncate text-sm transition-colors duration-500 ${p.out ? "text-zinc-600" : "text-zinc-100"}`}>{p.name}</p>
            </li>
          ))}
        </ul>
      </main>
      <aside className="flex w-72 shrink-0 flex-col gap-6">
        {live.qrSvg && (
          <div className="appear rounded-xl bg-white p-3">
            <div dangerouslySetInnerHTML={{ __html: live.qrSvg }} />
            <p className="mt-2 text-center text-sm font-medium text-black">Skann for å sjekke inn eller ut</p>
          </div>
        )}
        <div className="space-y-3">
          {data.stats.killsToday !== null && <Stat label="Drap i dag" value={String(data.stats.killsToday)} />}
          {data.stats.sinceLastKill !== null && <Stat label="Siden siste drap" value={data.stats.sinceLastKill ? since(data.stats.sinceLastKill, now) : "–"} />}
          {data.stats.topKillerToday && <Stat label="Dagens morder" value={`${data.stats.topKillerToday.name} (${data.stats.topKillerToday.kills})`} />}
        </div>
      </aside>

      <ScanToasts api={api} shown={shown} />
      <Announcement data={data} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p key={value} className="appear text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
