"use client";

import { useEffect, useRef, useState } from "react";
import { BloodCross } from "@/components/BloodCross";
import { Portrait } from "@/components/Portrait";
import type { BoardData } from "@/server/board";
import { Announcement, BoardMessage, boardImage, since, useBoard, useNow } from "@/components/BoardLive";

const API = "/api/status";

// A strip card is `w-56` (14rem). The strip shows as many as fit and flips to the next
// set every few seconds. No scrolling: the screen runs on a Raspberry Pi.
const CARD_REM = 14;
const PAGE_MS = 8000;

// The screen runs unattended for weeks: poll once a minute, and reload the whole page once a day
// to pick up new deploys and shed anything the browser has built up.
const REFRESH_MS = 60_000;
const RELOAD_MS = 24 * 60 * 60_000;
// The big panel switches between the last player out and the check-in QR code.
const FEATURE_MS = 30_000;

// Public, so no check-ins are shown: they would tell anyone online when a player is at the office.
export function Status() {
  const { data, qrSvg, error } = useBoard(API, { refreshMs: REFRESH_MS });
  const now = useNow(30_000);
  useDailyReload();

  if (error) return <BoardMessage>{error}</BoardMessage>;
  if (!data) return <BoardMessage>Laster …</BoardMessage>;

  return (
    <div className="status-screen flex h-dvh flex-col overflow-hidden">
      <header className="border-b border-white/10 px-12 py-6">
        <h1 className="font-display text-5xl text-blood">Mordvember</h1>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-8 p-8">
        <section className="flex min-h-0 flex-1 items-center gap-16 rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top_left,rgb(179_18_27/0.18),transparent_60%)] bg-white/[0.03] px-16 py-12">
          <div className="flex-1">
            <Label>Spillere igjen</Label>
            <p className="mt-6 font-display text-[16rem] leading-none text-white tabular-nums">
              <span key={data.alive} className="count-change">{data.alive}</span>
            </p>
            <p className="mt-2 text-3xl text-zinc-400">av {data.players.length} påmeldte</p>
          </div>
          <Feature data={data} qrSvg={qrSvg} now={now} />
        </section>

        <PlayerStrip players={data.players} />
      </main>

      <Announcement data={data} />
    </div>
  );
}

// Only reload when the server answers, so a brief outage doesn't leave a browser error page on the screen.
function useDailyReload() {
  useEffect(() => {
    let alive = true;
    let id: ReturnType<typeof setTimeout>;
    const reload = () =>
      fetch(location.href, { method: "HEAD", cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error();
          if (alive) location.reload();
        })
        .catch(() => {
          if (alive) id = setTimeout(reload, REFRESH_MS);
        });
    id = setTimeout(reload, RELOAD_MS);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, []);
}

// red-400 rather than the brand red: plain text on the dark panel needs it for WCAG AA contrast.
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xl font-semibold uppercase tracking-[0.15em] text-red-400">{children}</p>;
}

function Feature({ data, qrSvg, now }: { data: BoardData; qrSvg: string | null; now: number }) {
  const [showQr, setShowQr] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setShowQr((s) => !s), FEATURE_MS);
    return () => clearInterval(id);
  }, []);
  // With nobody out yet, the QR code is more useful than "Ingen er ute ennå".
  if (qrSvg && (showQr || !data.lastOut)) return <CheckinQr svg={qrSvg} />;
  return <LastOut data={data} now={now} />;
}

function CheckinQr({ svg }: { svg: string }) {
  return (
    <div className="flex h-full max-h-[34rem] w-[30rem] shrink-0 flex-col">
      <Label>Oppmøte</Label>
      <div className="appear mt-6 flex min-h-0 flex-1 flex-col items-center">
        <div className="aspect-square min-h-0 flex-1 rounded-2xl bg-white p-4 shadow-2xl [&>div]:h-full [&_svg]:h-full [&_svg]:w-full">
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <p className="mt-5 text-center text-2xl text-zinc-400">Skann for å sjekke inn eller ut</p>
      </div>
    </div>
  );
}

function LastOut({ data, now }: { data: BoardData; now: number }) {
  const last = data.lastOut;
  return (
    <div className="flex h-full max-h-[34rem] w-[30rem] shrink-0 flex-col">
      <Label>Sist ute</Label>
      {last ? (
        <div key={last.id} className="appear mt-6 flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
            <Portrait src={boardImage(API, last.id)} alt="" className="dead drain h-full w-full object-cover" />
            <BloodCross />
          </div>
          <p className="mt-5 truncate pb-1 text-5xl leading-tight font-semibold text-white">{last.name}</p>
          <p className="mt-2 text-2xl text-zinc-400">for {since(last.at, now)} siden</p>
        </div>
      ) : (
        <p className="mt-6 text-3xl text-zinc-400">Ingen er ute ennå</p>
      )}
    </div>
  );
}

function PlayerStrip({ players }: { players: BoardData["players"] }) {
  const ref = useRef<HTMLElement>(null);
  const [perPage, setPerPage] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const widthRem = el.clientWidth / parseFloat(getComputedStyle(document.documentElement).fontSize);
      setPerPage(Math.max(1, Math.floor(widthRem / CARD_REM)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pages = perPage ? Math.ceil(players.length / perPage) : 1;
  useEffect(() => {
    if (pages <= 1) return;
    const id = setInterval(() => setPage((p) => p + 1), PAGE_MS);
    return () => clearInterval(id);
  }, [pages]);

  const size = perPage ?? players.length;
  const start = (page % pages) * size;
  return (
    <section ref={ref} className="shrink-0 overflow-hidden" aria-label="Spillere">
      <ul className="flex justify-center">
        {players.slice(start, start + size).map((p) => (
          <li key={p.id} className="w-56 shrink-0 px-3">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="relative">
                <Portrait src={boardImage(API, p.id)} alt="" className={`aspect-[4/3] w-full object-cover ${p.out ? "dead" : ""}`} />
                {p.out && <BloodCross still />}
              </div>
              <p className={`truncate px-4 py-3 text-xl font-medium ${p.out ? "text-zinc-600" : "text-white"}`}>{p.name}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
