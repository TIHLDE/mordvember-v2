export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\"))
    return "/";
  return value;
}

/** Passed by loaders to preserve the requested path and query across login. */
export const PATH_HEADER = "x-mv-path";
