"use client";

import { useEffect, useState } from "react";

// Counts down from the server's time left, so a wrong clock on the phone doesn't move it.
export function TimeLeft({ remainingMs }: { remainingMs: number }) {
  const [deadline] = useState(() => Date.now() + remainingMs);
  const [left, setLeft] = useState(remainingMs);
  useEffect(() => {
    const id = setInterval(() => setLeft(deadline - Date.now()), 15000);
    return () => clearInterval(id);
  }, [deadline]);
  if (left <= 0) return <>Dagen teller nå</>;
  // Rounded up, so it never says the day counts before it does.
  const minutes = Math.ceil(left / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return <>{h > 0 ? `${h} t ${m} min igjen` : `${m} min igjen`}</>;
}
