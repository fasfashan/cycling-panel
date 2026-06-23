/**
 * Display-layer unit conversion & formatting.
 * Storage is raw metric (meters, m/s, seconds) — convert ONLY here.
 */

export function kmFromMeters(meters: number, digits = 1): string {
  return (meters / 1000).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function kmhFromMs(ms: number, digits = 1): string {
  return (ms * 3.6).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function metersRounded(meters: number): string {
  return Math.round(meters).toLocaleString("en-US");
}

/** Seconds → "9h 12m" / "45m" / "0m". */
export function durationFromSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

/**
 * Rider-local wall-clock date parts. Our start_local column stores the local
 * wall-clock as a UTC instant, so UTC getters yield the local calendar values.
 */
export function localDateLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  });
}

export function localTimeLabel(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Today · 06:14" / "Mon 16 Jun · 16:13" relative to rider-local now. */
export function relativeWhen(d: Date, todayIndex: number): string {
  const idx = localDayIndex(d);
  const time = localTimeLabel(d);
  if (idx === todayIndex) return `Today · ${time}`;
  if (idx === todayIndex - 1) return `Yesterday · ${time}`;
  const weekday = d.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
  });
  return `${weekday} ${localDateLabel(d)} · ${time}`;
}

/** Days since epoch using the local-wall-clock convention (UTC parts). */
export function localDayIndex(d: Date): number {
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000
  );
}
