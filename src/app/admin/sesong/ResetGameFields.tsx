"use client";

import { useState } from "react";
import { inputClass } from "@/components/styles";
import { Button } from "@/components/ui";

export function ResetGameFields({ seasonName }: { seasonName: string }) {
  const [confirmation, setConfirmation] = useState("");
  const requiredConfirmation = `Nullstill ${seasonName}`;

  return (
    <>
      <p className="w-full text-sm text-zinc-400">Skriv «{requiredConfirmation}» for å bekrefte.</p>
      <input
        name="confirm"
        required
        aria-label="Bekreft nullstilling"
        placeholder={requiredConfirmation}
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        className={`${inputClass} min-w-48 flex-1`}
      />
      <Button type="submit" variant="danger" disabled={confirmation !== requiredConfirmation}>
        Nullstill spillet
      </Button>
    </>
  );
}
