"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { ActionState } from "@/lib/action";

type Position = { lat: number; lng: number };

function currentPosition(): Promise<Position | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    ),
  );
}

export function CheckinButton({
  intent,
  complete,
}: {
  intent: "in" | "out";
  complete: (intent: "in" | "out", pos: Position | null) => Promise<ActionState>;
}) {
  const [state, setState] = useState<ActionState>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      // Only checking in needs the position.
      const pos = intent === "in" ? await currentPosition() : null;
      setState(await complete(intent, pos));
    } catch {
      setState({ error: "Fikk ikke kontakt med serveren. Prøv igjen." });
    } finally {
      setBusy(false);
    }
  }

  if (state?.ok) return <p className="success-pop font-display text-4xl text-emerald-400">{state.ok}</p>;
  return (
    <div className="space-y-4">
      <Button type="button" onClick={submit} disabled={busy}>
        {busy ? "Registrerer …" : intent === "in" ? "Sjekk inn" : "Sjekk ut"}
      </Button>
      {busy && intent === "in" && <p className="reveal-pulse text-sm text-zinc-400">Svar ja hvis mobilen spør om posisjon.</p>}
      {state?.error && <p className="appear text-red-400">{state.error}</p>}
    </div>
  );
}
