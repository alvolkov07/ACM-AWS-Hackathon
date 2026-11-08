export function initials(name?: string): string {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Farming season for the Northern Hemisphere, used for the small badge on the dashboard. */
export function season(date = new Date()): string {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return "Planting season";
  if (m >= 5 && m <= 7) return "Growing season";
  if (m >= 8 && m <= 10) return "Harvest season";
  return "Winter planning";
}

export function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function isSent(status?: string): boolean {
  return (status || "").startsWith("sent");
}
