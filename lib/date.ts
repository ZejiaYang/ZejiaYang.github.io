/** "2026-09-28" → "Sep 28, 2026", independent of the viewer's time zone. */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
