/**
 * Display-layer unit conversion & formatting (Indonesian locale).
 * Storage is raw metric (meters, m/s, seconds) — convert ONLY here.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** 74.3 → "74,3". */
export function fmtNum(value: number, digits = 1): string {
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function kmFromMeters(meters: number, digits = 1): string {
  return fmtNum(meters / 1000, digits);
}

export function kmhFromMs(ms: number, digits = 1): string {
  return fmtNum(ms * 3.6, digits);
}

export function metersRounded(meters: number): string {
  return Math.round(meters).toLocaleString("id-ID");
}

/** Seconds → "3 j 51 m" / "45 m". */
export function durationFromSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m} m` : `${h} j ${m} m`;
}

/**
 * Rider-local wall-clock date parts. Our start_local column stores the local
 * wall-clock as a UTC instant, so UTC getters yield the local calendar values.
 */
export function localDateLabel(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function localTimeLabel(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function weekdayLabel(d: Date): string {
  return WEEKDAYS[d.getUTCDay()];
}

/** Day index → Date at that local midnight. */
export function dateFromDayIndex(dayIndex: number): Date {
  return new Date(dayIndex * 86_400_000);
}

/** Monday day index → "19–25 Okt" or "29 Sep – 5 Okt". */
export function weekRangeLabel(mondayDayIndex: number): string {
  const a = dateFromDayIndex(mondayDayIndex);
  const b = dateFromDayIndex(mondayDayIndex + 6);
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
    : `${localDateLabel(a)} – ${localDateLabel(b)}`;
}

/** "hari ini" / "kemarin" / "3 hari lalu". */
export function daysAgoLabel(days: number): string {
  if (days <= 0) return "hari ini";
  if (days === 1) return "kemarin";
  return `${days} hari lalu`;
}

/** Days since epoch using the local-wall-clock convention (UTC parts). */
export function localDayIndex(d: Date): number {
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000
  );
}
