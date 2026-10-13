"use client";

import { useEffect, useState } from "react";
import type { BoardData } from "@/server/board";

type Live = { qrSvg: string | null; scans: { key: string; playerId: string; name: string; kind: "in" | "out" }[] };

function since(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} t ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} dager`;
}

export function Board({ token }: { token: string }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [live, setLive] = useState<Live>({ qrSvg: null, scans: [] });
  const [shown, setShown] = useState<Live["scans"]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/tavle/${token}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Lenken er ikke gyldig lenger"))))
        .then((d: BoardData) => alive && (setData(d), setError(null)))
        .catch((e: Error) => alive && setError(e.message));
    void load();
    const id = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token]);

  useEffect(() => {
    let alive = true;
    const seen = new Set<string>();
    const load = () =>
      fetch(`/api/tavle/${token}/live`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Live | null) => {
          if (!alive || !d) return;
          setLive(d);
          const fresh = d.scans.filter((s) => !seen.has(s.key));
          fresh.forEach((s) => seen.add(s.key));
          if (fresh.length) {
            setShown((cur) => [...fresh, ...cur].slice(0, 4));
            setTimeout(() => setShown((cur) => cur.filter((s) => !fresh.some((f) => f.key === s.key))), 6000);
          }
        })
        .catch(() => undefined);
    void load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (error && !data) return <div className="flex min-h-dvh items-center justify-center text-2xl text-zinc-500">{error}</div>;
  if (!data) return <div className="flex min-h-dvh items-center justify-center text-zinc-500">Laster …</div>;

  const img = (id: string) => `/api/tavle/${token}/bilde/${id}`;

  return (
    <div className="flex min-h-dvh gap-6 p-6">
      <main className="flex-1">
        <header className="mb-6 flex items-end justify-between">
          <h1 className="font-display text-6xl text-blood">Mordvember</h1>
          <div className="text-right">
            <p className="font-display text-7xl leading-none text-white">{data.alive}</p>
            <p className="text-zinc-400">spillere igjen</p>
          </div>
        </header>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
          {data.players.map((p) => (
            <li key={p.id} className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(p.id)} alt="" className={`aspect-square w-full rounded-lg object-cover ${p.out ? "dead" : ""}`} />
              <p className={`mt-1 truncate text-sm ${p.out ? "text-zinc-600" : "text-zinc-100"}`}>{p.name}</p>
            </li>
          ))}
        </ul>
      </main>
      <aside className="flex w-72 shrink-0 flex-col gap-6">
        {live.qrSvg && (
          <div className="rounded-xl bg-white p-3">
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

      {shown.length > 0 && (
        <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 gap-4">
          {shown.map((s) => (
            <div key={s.key} className="flex items-center gap-3 rounded-xl bg-black/90 p-3 pr-6 shadow-2xl ring-1 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(s.playerId)} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <div>
                <p className="text-lg font-semibold text-white">{s.name}</p>
                <p className={s.kind === "in" ? "text-emerald-400" : "text-amber-400"}>{s.kind === "in" ? "Sjekket inn" : "Sjekket ut"}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {(data.milestone || data.winner) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 text-center">
          <p className="font-display text-8xl text-blood">{data.winner ? "Vi har en vinner" : data.milestone?.label}</p>
          <p className="mt-6 text-5xl text-white">{data.winner ?? `${data.alive} spillere igjen`}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
