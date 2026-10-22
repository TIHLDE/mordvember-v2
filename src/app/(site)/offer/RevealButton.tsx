"use client";

import { useEffect, useRef, useState } from "react";

type Target = { name: string; image: string; bio: string | null };

export function RevealButton({ reveal }: { reveal: () => Promise<Target | null> }) {
  const [target, setTarget] = useState<Target | null>(null);
  const [empty, setEmpty] = useState(false);
  const [pressed, setPressed] = useState(false);
  const request = useRef(0);

  async function show() {
    const id = ++request.current;
    setPressed(true);
    const result = await reveal();
    if (id !== request.current) return;
    if (!result) setEmpty(true);
    setTarget(result);
  }

  // Hiding is deliberately instant (no exit animation) so the target never lingers on screen.
  function hide() {
    request.current++;
    setPressed(false);
    setTarget(null);
    setEmpty(false);
  }

  // Hide automatically when the tab is backgrounded or the phone is locked.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && hide();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        data-state={pressed ? "holding" : "idle"}
        className="reveal-frame flex aspect-square w-full max-w-72 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/50"
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
      <div className="min-h-8 space-y-2">
        <p className="h-8 text-2xl font-semibold tracking-tight text-white">{target && <span className="appear inline-block">{target.name}</span>}</p>
        {target?.bio && <p className="appear text-sm whitespace-pre-line text-zinc-300">{target.bio}</p>}
      </div>
      <button
        type="button"
        onClick={() => (pressed ? hide() : show())}
        aria-pressed={pressed}
        data-pressed={pressed || undefined}
        className="rounded-full bg-blood px-10 py-5 text-lg font-semibold text-white shadow-[0_10px_30px_-10px_rgb(179_18_27/0.6)] transition-[background-color,box-shadow,transform] duration-150 ease-out-strong select-none hover:bg-blood-light active:scale-95 data-[pressed]:scale-95 data-[pressed]:bg-blood-light data-[pressed]:shadow-none motion-reduce:active:scale-100 motion-reduce:data-[pressed]:scale-100"
      >
        {pressed ? "Skjul" : "Vis offer"}
      </button>
    </div>
  );
}
