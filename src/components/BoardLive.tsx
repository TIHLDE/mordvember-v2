"use client";

import { useEffect, useState } from "react";
import type { BoardData } from "@/server/board";

type Live = { qrSvg: string | null; scans: { key: string; playerId: string; name: string; kind: "in" | "out" }[] };
type Shown = Live["scans"][number] & { leaving?: boolean };

/** `api` is the board endpoint: `/api/tavle/<token>` for the office board, `/api/status` for the public screen. */
export const boardImage = (api: string, id: string) => `${api}/bilde/${id}`;

export function since(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} t ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} dager`;
}

export function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

export function useBoard(api: string, { withLive = true } = {}) {
  const [data, setData] = useState<BoardData | null>(null);
  const [live, setLive] = useState<Live>({ qrSvg: null, scans: [] });
  const [shown, setShown] = useState<Shown[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(api, { cache: "no-store" })
        .then(async (r) => {
          if (!alive) return;
          if (r.status === 404) {
            setData(null);
            setError(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "Lenken er ikke gyldig lenger");
            return;
          }
          if (r.ok) {
            setData((await r.json()) as BoardData);
            setError(null);
          }
        })
        .catch(() => undefined);
    void load();
    const id = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [api]);

  useEffect(() => {
    if (!withLive) return;
    let alive = true;
    const seen = new Set<string>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const load = () =>
      fetch(`${api}/live`, { cache: "no-store" })
        .then((r) => (r.status === 404 ? { qrSvg: null, scans: [] } : r.ok ? r.json() : null))
        .then((d: Live | null) => {
          if (!alive || !d) return;
          setLive(d);
          const fresh = d.scans.filter((s) => !seen.has(s.key));
          fresh.forEach((s) => seen.add(s.key));
          if (fresh.length) {
            setShown((cur) => [...fresh, ...cur].slice(0, 4));
            const isFresh = (s: Shown) => fresh.some((f) => f.key === s.key);
            const later = (ms: number, fn: () => void) => {
              const timer = setTimeout(() => {
                timers.delete(timer);
                fn();
              }, ms);
              timers.add(timer);
            };
            later(6000, () => setShown((cur) => cur.map((s) => (isFresh(s) ? { ...s, leaving: true } : s))));
            later(6300, () => setShown((cur) => cur.filter((s) => !isFresh(s))));
          }
        })
        .catch(() => undefined);
    void load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
      timers.forEach(clearTimeout);
    };
  }, [api, withLive]);

  return { data, live, shown, error };
}

export function BoardMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center text-2xl text-zinc-500">{children}</div>;
}

export function ScanToasts({ api, shown }: { api: string; shown: Shown[] }) {
  if (!shown.length) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 gap-4">
      {shown.map((s) => (
        <div key={s.key} data-leaving={s.leaving || undefined} className="toast glass flex items-center gap-3 rounded-xl p-3 pr-6 shadow-2xl ring-1 ring-white/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={boardImage(api, s.playerId)} alt="" className="h-16 w-16 rounded-lg object-cover" />
          <div>
            <p className="text-lg font-semibold text-white">{s.name}</p>
            <p className={s.kind === "in" ? "text-emerald-400" : "text-amber-400"}>{s.kind === "in" ? "Sjekket inn" : "Sjekket ut"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Announcement({ data }: { data: BoardData }) {
  if (!data.milestone && !data.winner) return null;
  return (
    <div className="overlay fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-center backdrop-blur-xl">
      <p className="font-display text-8xl text-blood">{data.winner ? "Vi har en vinner" : data.milestone?.label}</p>
      <p className="mt-6 text-5xl text-white">{data.winner ?? `${data.alive} spillere igjen`}</p>
    </div>
  );
}
