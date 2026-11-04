/** Time labels for the chat list. (Chats themselves are kept per session on the backend.) */

export function shortDate(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "just now", "5m ago", "2h ago", "3d ago", then a date. Empty when `now` is unknown (server render). */
export function timeAgo(ts: string, now: number): string {
  const then = new Date(ts).getTime();
  if (!now || Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return shortDate(ts);
}
