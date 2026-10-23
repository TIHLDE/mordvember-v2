import type { SWRConfiguration } from "swr";

/** `api` is the board endpoint, `/api/status`. */
export const boardImage = (api: string, id: string) => `${api}/bilde/${id}`;

export function since(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} t ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} dager`;
}

/**
 * Polling for a screen that runs unattended: keep polling while hidden or offline, and retry
 * failed requests at a steady pace instead of SWR's growing backoff.
 */
export function boardPolling(retryMs: number): SWRConfiguration {
  return {
    refreshWhenHidden: true,
    refreshWhenOffline: true,
    revalidateOnFocus: false,
    onErrorRetry: (_error, _key, _config, revalidate) => {
      setTimeout(() => void revalidate(), retryMs);
    },
  };
}
