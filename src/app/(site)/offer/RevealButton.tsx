"use client";

import { useRef, useState } from "react";

export function RevealButton({ reveal }: { reveal: () => Promise<{ name: string; image: string } | null> }) {
  const [target, setTarget] = useState<{ name: string; image: string } | null>(null);
  const [empty, setEmpty] = useState(false);
  const [pressed, setPressed] = useState(false);
  const holding = useRef(false);

  async function start() {
    holding.current = true;
    setPressed(true);
    const result = await reveal();
    if (!holding.current) return;
    if (!result) setEmpty(true);
    setTarget(result);
  }

  // Hiding is deliberately instant (no exit animation) so the target never lingers on screen.
  function stop() {
    holding.current = false;
    setPressed(false);
    setTarget(null);
    setEmpty(false);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        data-state={pressed ? "holding" : "idle"}
        className="reveal-frame flex aspect-square w-64 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/50"
      >
        {target ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={target.image} alt="" className="reveal-image h-full w-full object-cover" draggable={false} />
        ) : (
          <span key={empty ? "empty" : pressed ? "loading" : "idle"} className={`appear px-6 text-center text-sm text-zinc-500 ${pressed && !empty ? "reveal-pulse" : ""}`}>
            {empty ? "Du har ikke noe offer nå" : pressed ? "Henter …" : "Skjult"}
          </span>
        )}
      </div>
      <p className="h-8 text-2xl font-semibold tracking-tight text-white">{target && <span className="appear inline-block">{target.name}</span>}</p>
      <button
        type="button"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !holding.current) start();
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") stop();
        }}
        onBlur={stop}
        data-pressed={pressed || undefined}
        className="press select-none touch-none rounded-full bg-blood px-10 py-5 text-lg font-semibold text-white shadow-[0_10px_30px_-10px_rgb(179_18_27/0.6)] data-[pressed]:bg-blood-light data-[pressed]:shadow-none"
      >
        Hold inne for å vise
      </button>
    </div>
  );
}
