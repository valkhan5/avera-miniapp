const TK_OFFSET_MS = 5 * 3600 * 1000; // Asia/Tashkent, fixed UTC+5

/** YYYY-MM-DD and hour in Tashkent for a given instant. */
export function tashkentParts(now: Date): { date: string; hour: number } {
  const t = new Date(now.getTime() + TK_OFFSET_MS);
  return { date: t.toISOString().slice(0, 10), hour: t.getUTCHours() };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function availableDates(now: Date, lastDate: string, cutoffHour: number): string[] {
  const { date, hour } = tashkentParts(now);
  let d = hour < cutoffHour ? date : addDays(date, 1);
  const out: string[] = [];
  while (d <= lastDate) { out.push(d); d = addDays(d, 1); }
  return out;
}
