"use client";

import { useEffect, useState } from "react";
import type { BoardData } from "@/server/board";

/** `api` is the board endpoint, `/api/status`. */
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

const QR_FALLBACK_MS = 60_000;
const QR_RETRY_MS = 5_000;

export function useBoard(api: string, { refreshMs = 10_000 } = {}) {
  const [data, setData] = useState<BoardData | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
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
    const id = setInterval(load, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [api, refreshMs]);

  // The QR code changes every hour. The server says when the next one starts, so the board
  // fetches it right then. The fallback poll picks up the game starting or ending and failed requests.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      // The timeout also covers reading the body, so a stalled response still ends in a retry.
      fetch(`${api}/live`, { cache: "no-store", signal: AbortSignal.timeout(QR_RETRY_MS * 2) })
        .then((r) => (r.ok ? (r.json() as Promise<{ qrSvg: string | null; nextCodeInMs: number }>) : null))
        .then((d) => {
          if (!alive) return;
          if (d) setQrSvg(d.qrSvg);
          const next = d ? Math.min(d.nextCodeInMs + 1000, QR_FALLBACK_MS) : QR_RETRY_MS;
          timer = setTimeout(load, next);
        })
        .catch(() => {
          if (alive) timer = setTimeout(load, QR_RETRY_MS);
        });
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [api]);

  return { data, qrSvg, error };
}

export function BoardMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center text-2xl text-zinc-500">{children}</div>;
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
