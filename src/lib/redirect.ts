export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

/** Set by the proxy to the requested path and query. */
export const PATH_HEADER = "x-mv-path";
