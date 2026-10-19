"use client";

import { useEffect, useId, useState } from "react";
import { inputClass } from "@/components/ui";

type Result = { username: string; name: string };

export function UserSearch({ name, className = "" }: { name: string; className?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Result | null>(null);
  const listId = useId();

  const term = query.trim();
  useEffect(() => {
    if (picked || term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/brukersok?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const body = (await response.json()) as { users?: Result[]; error?: string };
        setResults(body.users ?? []);
        setError(body.error ?? null);
        setActive(0);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? "Søket i Photon feilet. Prøv igjen." : null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term, picked]);

  const pick = (user: Result) => {
    setPicked(user);
    setQuery(user.username);
    setOpen(false);
  };

  const showList = open && !picked && term.length >= 2;

  return (
    <div className={`relative ${className}`}>
      <input
        name={name}
        required
        role="combobox"
        aria-label="Søk etter navn eller brukernavn i Photon"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Søk etter navn eller brukernavn"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPicked(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!showList || results.length === 0) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={inputClass}
      />
      {picked && <p className="mt-1 text-xs text-zinc-400">{picked.name}</p>}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 p-1 text-sm shadow-xl shadow-black/60"
        >
          {results.map((user, i) => (
            <li
              key={user.username}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(user)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-2 ${i === active ? "bg-white/10 text-white" : "text-zinc-300"}`}
            >
              <span className="truncate">{user.name}</span>
              <span className="shrink-0 text-xs text-zinc-500">{user.username}</span>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-2 text-zinc-500">{loading ? "Søker …" : error ?? "Ingen treff."}</li>
          )}
        </ul>
      )}
    </div>
  );
}
