"use client";

import { useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/action";

export function CompleteScan({ complete }: { complete: (pos: { lat: number; lng: number } | null) => Promise<ActionState> }) {
  const [state, setState] = useState<ActionState>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const finish = (pos: { lat: number; lng: number } | null) => complete(pos).then(setState);
    if (!("geolocation" in navigator)) {
      void finish(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => void finish({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => void finish(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [complete]);

  if (!state) return <p className="text-zinc-400">Registrerer … Svar ja hvis mobilen spør om posisjon.</p>;
  if (state.error) return <p className="text-red-400">{state.error}</p>;
  return <p className="font-display text-4xl text-emerald-400">{state.ok}</p>;
}
