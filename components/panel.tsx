import Link from "next/link";

import type { Activity } from "@/lib/db/schema";
import {
  dateFromDayIndex,
  durationFromSeconds,
  fmtNum,
  kmFromMeters,
  localDateLabel,
  localDayIndex,
  metersRounded,
  weekRangeLabel,
  weekdayLabel,
} from "@/lib/format";
import { JUMP_WARN } from "@/lib/stats/planner";
import type { WeekPoint } from "@/lib/stats/planner";
import { cn } from "@/lib/utils";

export function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-3 mt-9 flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {aside ? <span className="text-xs text-muted-foreground">{aside}</span> : null}
    </div>
  );
}

/**
 * Identity motif: a stepped meter that echoes the rider's 1x9 cassette,
 * taller "cogs" toward the hard end. Used for Perceived Exertion.
 */
export function CassetteMeter({ value, max = 10 }: { value: number; max?: number }) {
  const hard = value >= 8;
  return (
    <span className="flex items-end gap-[3px]" role="img" aria-label={`RPE ${value} dari ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={cn("w-[7px] rounded-[2px]", i < value ? (hard ? "bg-rest" : "bg-brand") : "bg-raised")}
          style={{ height: 8 + Math.round(((i + 1) / max) * 16) }}
        />
      ))}
    </span>
  );
}

/**
 * Weekly volume bars. With `showSafety`, each week shows its own safe ceiling
 * (previous week + 10%) as a dashed line and its change vs the week before;
 * only jumps above JUMP_WARN turn red, matching the coach's overreach rule.
 */
export function WeekChart({
  weeks,
  showSafety = true,
  height = 132,
}: {
  weeks: WeekPoint[];
  showSafety?: boolean;
  height?: number;
}) {
  const max = Math.max(10, ...weeks.map((w) => Math.max(w.distanceKm, w.ceilingKm ?? 0)));
  const summary = weeks
    .map((w) => `${weekRangeLabel(w.monday)}: ${fmtNum(w.distanceKm)} km`)
    .join("; ");

  return (
    <div className="flex items-end gap-1" role="img" aria-label={summary}>
      {weeks.map((w, i) => {
        const over = showSafety && w.jump !== null && w.jump > JUMP_WARN;
        const pct = showSafety && w.jump !== null ? Math.round(w.jump * 100) : null;
        const showLabel = showSafety || w.isCurrentWeek || (weeks.length - 1 - i) % 2 === 0;
        const d = dateFromDayIndex(w.monday);
        const barH = Math.max(w.distanceKm > 0 ? 3 : 0, (w.distanceKm / max) * height);

        return (
          <div key={w.monday} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                "text-[11px] tabular-nums",
                w.isCurrentWeek ? "font-semibold text-brand" : over ? "font-medium text-rest" : "text-muted-foreground"
              )}
            >
              {fmtNum(w.distanceKm, 0)}
            </span>
            <div className="relative w-full" style={{ height }}>
              {showSafety && w.ceilingKm !== null ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 border-t-2 border-dashed border-foreground/50"
                  style={{ bottom: (w.ceilingKm / max) * height }}
                />
              ) : null}
              <span
                className={cn(
                  "absolute bottom-0 left-1/2 w-[62%] -translate-x-1/2 rounded-t-[3px]",
                  w.isCurrentWeek ? "bg-brand" : over ? "bg-rest" : "bg-muted-foreground/55"
                )}
                style={{ height: barH }}
              />
            </div>
            <span
              className={cn(
                "whitespace-nowrap text-[11px]",
                w.isCurrentWeek ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {w.isCurrentWeek ? "Ini" : showLabel ? localDateLabel(d) : " "}
            </span>
            {showSafety ? (
              <span className={cn("text-[10px] tabular-nums", over ? "font-semibold text-rest" : "text-muted-foreground")}>
                {pct === null ? " " : `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}%`}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function WeekChartLegend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="w-4 border-t-2 border-dashed border-foreground/50" />
        Batas aman (minggu sebelumnya + 10%)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-sm bg-rest" />
        Naik lebih dari 30% dari minggu sebelumnya
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-sm bg-brand" />
        Minggu ini
      </span>
    </div>
  );
}

/** `prCount`: ride-level records this ride set (lib/stats/records), not Strava segment PRs. */
export function RideRow({ ride, card = false, prCount = 0 }: { ride: Activity; card?: boolean; prCount?: number }) {
  return (
    <Link
      href={`/activities/${ride.id}`}
      className={cn(
        "flex w-full items-center gap-3 text-left",
        card ? "rounded-lg bg-surface p-4 hover:bg-raised" : "border-b border-line py-3.5"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{ride.name}</span>
        <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
          {weekdayLabel(ride.startLocal)} {localDateLabel(ride.startLocal)} · {durationFromSeconds(ride.movingTimeS)} ·{" "}
          {metersRounded(ride.elevationGainM)} m naik
          {prCount > 0 ? <span className="text-brand"> · {prCount} PR</span> : null}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-heading text-lg font-semibold tabular-nums">
          {kmFromMeters(ride.distanceM)}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">km</span>
        </span>
        <span
          className={cn(
            "block text-xs tabular-nums",
            ride.rpe === null ? "text-muted-foreground" : ride.rpe >= 8 ? "text-rest" : "text-foreground"
          )}
        >
          {ride.rpe === null ? "RPE –" : `RPE ${ride.rpe}`}
        </span>
      </span>
    </Link>
  );
}

export function EmptyState({
  title,
  body,
  href = "https://www.strava.com/upload/select",
  cta = "Upload ride di Strava",
}: {
  title: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex min-h-[60dvh] flex-col justify-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-[32ch] text-[15px] leading-6 text-muted-foreground">{body}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex h-11 w-fit items-center rounded-md bg-brand px-4 text-sm font-semibold text-background"
      >
        {cta}
      </a>
    </div>
  );
}

/** Day index of a ride's local date. */
export function rideDay(ride: Activity): number {
  return localDayIndex(ride.startLocal);
}
