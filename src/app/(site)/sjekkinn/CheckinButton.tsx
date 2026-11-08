"use client";

import { useState } from "react";
import { Button, Notice } from "@/components/ui";
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
  countsAt,
}: {
  intent: "in" | "out";
  complete: (intent: "in" | "out", pos: Position | null) => Promise<ActionState>;
  // Only set when staying longer would still make the day count.
  countsAt?: { remainingMs: number; label: string; hours: string };
}) {
  const [state, setState] = useState<ActionState>(null);
  const [busy, setBusy] = useState(false);
  const [warned, setWarned] = useState(false);
  // The page may have been open a while, so the deadline is checked when the button is pressed.
  const [deadline] = useState(() => (countsAt ? Date.now() + countsAt.remainingMs : 0));

  async function submit() {
    if (intent === "out" && countsAt && Date.now() < deadline && !warned) {
      setWarned(true);
      return;
    }
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

  if (state?.ok)
    return <p className="success-pop font-display text-4xl text-emerald-400">{state.ok}</p>;
  if (warned && countsAt) {
    return (
      <div className="appear space-y-4">
        <Notice tone="amber">
          Du har ikke vært her i {countsAt.hours} ennå. Sjekker du ut nå, blir ikke dagen godkjent.
          Blir du til kl. {countsAt.label}, teller den. Sjekker du inn igjen senere, starter tiden
          på nytt.
        </Notice>
        <div className="flex justify-center gap-3">
          <Button type="button" variant="ghost" onClick={() => setWarned(false)} disabled={busy}>
            Bli sjekket inn
          </Button>
          <Button type="button" variant="danger" onClick={submit} disabled={busy}>
            {busy ? "Registrerer …" : "Sjekk ut likevel"}
          </Button>
        </div>
        {state?.error && <p className="appear text-red-400">{state.error}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Button type="button" onClick={submit} disabled={busy}>
        {busy ? "Registrerer …" : intent === "in" ? "Sjekk inn" : "Sjekk ut"}
      </Button>
      {busy && intent === "in" && (
        <p className="reveal-pulse text-sm text-zinc-400">Svar ja hvis mobilen spør om posisjon.</p>
      )}
      {state?.error && <p className="appear text-red-400">{state.error}</p>}
    </div>
  );
}
