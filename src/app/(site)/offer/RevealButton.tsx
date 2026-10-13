"use client";

import { useRef, useState } from "react";

export function RevealButton({ reveal }: { reveal: () => Promise<{ name: string; image: string } | null> }) {
  const [target, setTarget] = useState<{ name: string; image: string } | null>(null);
  const [empty, setEmpty] = useState(false);
  const holding = useRef(false);

  async function start() {
    holding.current = true;
    const result = await reveal();
    if (!holding.current) return;
    if (!result) setEmpty(true);
    setTarget(result);
  }

  function stop() {
    holding.current = false;
    setTarget(null);
    setEmpty(false);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex aspect-square w-64 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/50">
        {target ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={target.image} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <span className="px-6 text-center text-sm text-zinc-500">{empty ? "Du har ikke noe offer nå" : "Skjult"}</span>
        )}
      </div>
      <p className="h-8 text-2xl font-semibold text-white">{target?.name ?? ""}</p>
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
        className="select-none touch-none rounded-full bg-blood px-10 py-5 text-lg font-semibold text-white active:scale-95"
      >
        Hold inne for å vise
      </button>
    </div>
  );
}
