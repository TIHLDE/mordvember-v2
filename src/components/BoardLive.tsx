"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { boardPolling } from "@/lib/board";
import type { BoardData } from "@/server/board";

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
// SWR waits for a pending request before polling again, so a stalled response must time out.
const BOARD_TIMEOUT_MS = 20_000;

// A 404 means the board itself is gone, so it replaces the data instead of failing: a later
// failure keeps showing the message. Other failures keep the last data on screen.
type BoardState = { board: BoardData } | { gone: string };

async function fetchBoard(api: string): Promise<BoardState> {
  // The timeout also covers reading the body.
  const response = await fetch(api, {
    cache: "no-store",
    signal: AbortSignal.timeout(BOARD_TIMEOUT_MS),
  });
  if (response.status === 404) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return { gone: body?.error ?? "Lenken er ikke gyldig lenger" };
  }
  if (!response.ok) throw new Error(`Statusskjermen svarte ${response.status}`);
  return { board: (await response.json()) as BoardData };
}

type Live = { qrSvg: string | null; nextCodeInMs: number };

async function fetchLive(url: string): Promise<Live> {
  // The timeout also covers reading the body, so a stalled response still ends in a retry.
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(QR_RETRY_MS * 2),
  });
  if (!response.ok) throw new Error(`QR-koden svarte ${response.status}`);
  return (await response.json()) as Live;
}

// Module-level, because SWR restarts its polling timer whenever this function changes identity.
const liveInterval = (live: Live | undefined) =>
  live ? Math.min(live.nextCodeInMs + 1000, QR_FALLBACK_MS) : QR_RETRY_MS;

export function useBoard(api: string, { refreshMs = 10_000 } = {}) {
  const board = useSWR(api, fetchBoard, { ...boardPolling(refreshMs), refreshInterval: refreshMs });

  // The QR code changes every hour. The server says when the next one starts, so the board
  // fetches it right then. The fallback poll picks up the game starting or ending.
  const live = useSWR(`${api}/live`, fetchLive, {
    ...boardPolling(QR_RETRY_MS),
    refreshInterval: liveInterval,
  });

  const state = board.data;
  return {
    data: state && "board" in state ? state.board : null,
    qrSvg: live.data?.qrSvg ?? null,
    error: state && "gone" in state ? state.gone : null,
  };
}

export function BoardMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center text-2xl text-zinc-500">
      {children}
    </div>
  );
}

export function Announcement({ data }: { data: BoardData }) {
  if (!data.winner) return null;
  return (
    <div className="overlay fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-center backdrop-blur-xl">
      <p className="font-display text-8xl text-blood">Vi har en vinner</p>
      <p className="mt-6 text-5xl text-white">{data.winner}</p>
    </div>
  );
}
