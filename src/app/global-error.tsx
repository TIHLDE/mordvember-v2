"use client";

import { useEffect } from "react";
import "./globals.css";
import { buttonClass } from "@/components/styles";

const RELOADED_AT = "mv_error_reload";
const RELOAD_WINDOW_MS = 60_000;

// A navigation that fails halfway (dropped chunk, cut-off response, tab left open across a deploy) has already
// moved the URL to the right page, so one full reload recovers it. The window stops a real bug from looping.
function reloadOnce() {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED_AT)) < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

export default function GlobalError({ error }: { error: unknown }) {
  useEffect(() => {
    // Client components can throw anything, not just an Error.
    const details =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { message: String(error) };
    navigator.sendBeacon(
      "/api/klientfeil",
      JSON.stringify({ ...details, path: location.pathname }),
    );
    reloadOnce();
  }, [error]);

  return (
    <>
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-4xl text-blood">Siden lastet ikke</h1>
        <p className="mt-3 mb-6 text-sm text-zinc-400">
          Dette skyldes ofte dårlig nett. Prøv igjen.
        </p>
        <button type="button" onClick={() => location.reload()} className={buttonClass()}>
          Last inn på nytt
        </button>
      </main>
    </>
  );
}
