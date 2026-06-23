import { asc } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import type { Activity } from "@/lib/db/schema";
import { localDayIndex } from "@/lib/format";

const RIDER_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

function isRide(sportType: string): boolean {
  return /ride/i.test(sportType);
}

function mondayOf(dayIndex: number): number {
  const dow = new Date(dayIndex * 86_400_000).getUTCDay();
  return dayIndex - ((dow + 6) % 7);
}

function todayIndex(): number {
  return localDayIndex(new Date(Date.now() + RIDER_TZ_OFFSET_MS));
}

function weekLabel(mondayDayIndex: number): string {
  return new Date(mondayDayIndex * 86_400_000).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  });
}

export type WeekSummary = {
  label: string; // "Mon 16 Jun"
  distanceKm: number;
  rides: number;
  isCurrentWeek: boolean;
};

export type OverreachLevel = "none" | "caution" | "high";

export type PlannerData = {
  hasData: boolean;
  recentWeeks: WeekSummary[];
  /** The completed week we apply the 10% rule to. */
  baselineKm: number;
  /** baselineKm × 1.10 — the ceiling we're aiming to stay under. */
  safeTargetKm: number;
  /** How far the rider has gone this week so far. */
  currentWeekKm: number;
  /** Remaining safe km this week (can be 0 if already at/over target). */
  remainingKm: number;
  /** Suggested distance for the next single ride. */
  suggestedNextRideKm: number;
  overreach: OverreachLevel;
  /** Human-readable note about overreach (null when level is "none"). */
  overreachNote: string | null;
  /** True when we have enough history to make a meaningful suggestion. */
  hasBaseline: boolean;
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function getPlannerData(): Promise<PlannerData> {
  const db = getDb();
  const rows = (await db
    .select()
    .from(activities)
    .orderBy(asc(activities.startDate))) as Activity[];

  const rides = rows.filter((a) => isRide(a.sportType));

  const today = todayIndex();
  const thisWeekMonday = mondayOf(today);

  if (rides.length === 0) {
    return empty(today, thisWeekMonday);
  }

  // ── Bucket rides into weeks ──────────────────────────────────────────
  const weekMap = new Map<number, { distanceKm: number; rides: number }>();
  for (const a of rides) {
    const mon = mondayOf(localDayIndex(a.startLocal));
    const prev = weekMap.get(mon) ?? { distanceKm: 0, rides: 0 };
    weekMap.set(mon, {
      distanceKm: prev.distanceKm + a.distanceM / 1000,
      rides: prev.rides + 1,
    });
  }

  const sortedWeeks = [...weekMap.entries()].sort((a, b) => a[0] - b[0]);

  // Recent 6 weeks for display (include current partial week).
  const recentWeeks: WeekSummary[] = sortedWeeks.slice(-6).map(([mon, v]) => ({
    label: weekLabel(mon),
    distanceKm: Math.round(v.distanceKm * 10) / 10,
    rides: v.rides,
    isCurrentWeek: mon === thisWeekMonday,
  }));

  const currentWeekKm = weekMap.get(thisWeekMonday)?.distanceKm ?? 0;

  // ── Baseline: last COMPLETED week before this one ────────────────────
  const completedWeeks = sortedWeeks.filter(([mon]) => mon < thisWeekMonday);
  const hasBaseline = completedWeeks.length > 0;

  let baselineKm = 0;
  if (hasBaseline) {
    // Use the most recent completed week.
    baselineKm = completedWeeks[completedWeeks.length - 1][1].distanceKm;
  } else {
    // No complete week yet — treat current week pace as baseline.
    const daysElapsed = Math.max(1, today - thisWeekMonday + 1);
    baselineKm = (currentWeekKm / daysElapsed) * 7;
  }
  baselineKm = Math.round(baselineKm * 10) / 10;

  const safeTargetKm = Math.round(baselineKm * 1.1 * 10) / 10;
  const remainingKm = Math.max(0, safeTargetKm - currentWeekKm);

  // ── Suggested next ride ──────────────────────────────────────────────
  // Median of last 5 rides >= 3 km (excludes quick errands).
  const meaningfulRides = rides
    .filter((a) => a.distanceM >= 3000)
    .slice(-5)
    .map((a) => a.distanceM / 1000);

  let suggestedNextRideKm = Math.round(median(meaningfulRides) * 2) / 2; // round to 0.5km
  // Don't suggest more than what's left in the safe budget, minimum 3km.
  if (remainingKm > 0) {
    suggestedNextRideKm = Math.min(suggestedNextRideKm, remainingKm);
  }
  suggestedNextRideKm = Math.max(3, suggestedNextRideKm);

  // ── Overreach detection ──────────────────────────────────────────────
  let overreach: OverreachLevel = "none";
  let overreachNote: string | null = null;

  // Check if last completed week itself was already an aggressive jump.
  if (completedWeeks.length >= 2) {
    const prevKm =
      completedWeeks[completedWeeks.length - 2][1].distanceKm;
    const lastKm =
      completedWeeks[completedWeeks.length - 1][1].distanceKm;
    const jump = prevKm > 0 ? (lastKm - prevKm) / prevKm : 0;
    if (jump > 0.3) {
      overreach = "caution";
      overreachNote = `Last week was ${Math.round(jump * 100)}% more than the week before — your body may still be catching up. Keep this week controlled.`;
    }
  }

  // Check current week vs safe target.
  if (safeTargetKm > 0 && currentWeekKm > safeTargetKm * 1.3) {
    overreach = "high";
    overreachNote = `This week you're already at ${Math.round(currentWeekKm * 10) / 10} km — ${Math.round((currentWeekKm / safeTargetKm - 1) * 100)}% over the safe ceiling of ${safeTargetKm} km. Consider a rest day or a very short spin before adding more volume.`;
  } else if (safeTargetKm > 0 && currentWeekKm > safeTargetKm) {
    overreach = "caution";
    overreachNote = `You've nudged past the safe weekly target (${safeTargetKm} km). You can keep riding — just keep the remaining rides easy and short.`;
  }

  return {
    hasData: true,
    hasBaseline,
    recentWeeks,
    baselineKm,
    safeTargetKm,
    currentWeekKm: Math.round(currentWeekKm * 10) / 10,
    remainingKm: Math.round(remainingKm * 10) / 10,
    suggestedNextRideKm,
    overreach,
    overreachNote,
  };
}

function empty(today: number, thisWeekMonday: number): PlannerData {
  void today;
  void thisWeekMonday;
  return {
    hasData: false,
    hasBaseline: false,
    recentWeeks: [],
    baselineKm: 0,
    safeTargetKm: 0,
    currentWeekKm: 0,
    remainingKm: 0,
    suggestedNextRideKm: 0,
    overreach: "none",
    overreachNote: null,
  };
}
