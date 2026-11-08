"use client";

import { useEffect, useId, useState } from "react";
import useSWR from "swr";
import { inputClass } from "@/components/styles";

type Result = { username: string; name: string };

const SEARCH_FAILED = "Søket i Photon feilet. Prøv igjen.";
// SWR reuses a pending request for the same query, so a stalled one must end for the query to be retried.
const SEARCH_TIMEOUT_MS = 8_000;

async function searchUsers(url: string): Promise<Result[]> {
  // The timeout also covers reading the body.
  const response = await fetch(url, { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) }).catch(
    () => null,
  );
  if (!response) throw new Error(SEARCH_FAILED);
  const body = (await response.json().catch(() => null)) as {
    users?: Result[];
    error?: string;
    login?: boolean;
  } | null;
  // Photon revokes the token when the user logs out of tihlde.org, so send them through login and back here.
  // /api/auth/login is a route handler that redirects to Photon, so the router cannot navigate to it.
  if (response.status === 401 && body?.login) {
    window.location.assign(
      `/api/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
    );
  }
  if (!response.ok || !body) throw new Error(body?.error ?? SEARCH_FAILED);
  return body.users ?? [];
}

// Searches 250 ms after typing stops. Only results for what is typed right now are returned,
// never those of an earlier query.
function useUserSearch(term: string, enabled: boolean) {
  const [searchTerm, setSearchTerm] = useState(term);
  useEffect(() => {
    const id = setTimeout(() => setSearchTerm(term), 250);
    return () => clearTimeout(id);
  }, [term]);
  const key =
    enabled && searchTerm.length >= 2 ? `/api/brukersok?q=${encodeURIComponent(searchTerm)}` : null;
  const search = useSWR(key, searchUsers, { revalidateOnFocus: false, shouldRetryOnError: false });
  const current = term === searchTerm;
  const error = current && search.error instanceof Error ? search.error.message : null;
  return {
    results: current && !error ? (search.data ?? []) : [],
    error,
    searching: !current || search.isLoading,
  };
}

export function UserSearch({ name, className = "" }: { name: string; className?: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Result | null>(null);
  const listId = useId();

  const term = query.trim();
  const { results, error, searching } = useUserSearch(term, !picked);
  // New results can be shorter than the list the selection was made in.
  const selected = Math.min(active, Math.max(results.length - 1, 0));

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
        aria-activedescendant={showList && results[selected] ? `${listId}-${selected}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Søk etter navn eller brukernavn"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPicked(null);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          // Enter submits the role form, so it must wait until the search for this text has answered.
          if (showList && searching && e.key === "Enter") return e.preventDefault();
          if (!showList || results.length === 0) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive(
              (selected + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length,
            );
          } else if (e.key === "Enter") {
            e.preventDefault();
            const user = results[selected];
            if (user) pick(user);
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
              aria-selected={i === selected}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(user)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-2 ${i === selected ? "bg-white/10 text-white" : "text-zinc-300"}`}
            >
              <span className="truncate">{user.name}</span>
              <span className="shrink-0 text-xs text-zinc-500">{user.username}</span>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-2 text-zinc-500">
              {searching ? "Søker …" : (error ?? "Ingen treff.")}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
