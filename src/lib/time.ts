export function msAgo(ms: number): Date {
  return new Date(Date.now() - ms);
}
