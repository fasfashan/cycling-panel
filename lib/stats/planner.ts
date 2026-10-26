import { asc } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import type { Activity } from "@/lib/db/schema";
import { fmtNum, localDayIndex } from "@/lib/format";

const RIDER_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
/** A week-over-week jump above this is flagged as overreach (and drawn red). */
export const JUMP_WARN = 0.3;

function isRide(sportType: string): boolean {
  return /ride/i.test(sportType);
}

export function mondayOf(dayIndex: number): number {
  const dow = new Date(dayIndex * 86_400_000).getUTCDay();
  return dayIndex - ((dow + 6) % 7);
}

export function todayIndex(): number {
  return localDayIndex(new Date(Date.now() + RIDER_TZ_OFFSET_MS));
}

export type WeekPoint = {
  /** Day index of the week's Monday. */
  monday: number;
  distanceKm: number;
  rides: number;
  isCurrentWeek: boolean;
  /** Previous week + 10%; null when the previous week had no riding. */
  ceilingKm: number | null;
  /** Change vs previous week (0.66 = +66%); null for the current week or after an empty week. */
  jump: number | null;
};

export type OverreachLevel = "none" | "caution" | "high";

export type PlannerData = {
  hasData: boolean;
  /** Every week from the first ride to this week, empty weeks included. */
  weeks: WeekPoint[];
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
  /** Last completed week vs the one before it. */
  lastWeekJump: { previousKm: number; lastKm: number; jump: number } | null;
  /** True when we have enough history to make a meaningful suggestion. */
  hasBaseline: boolean;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function weekSeries(rides: Activity[], thisWeekMonday: number): WeekPoint[] {
  const totals = new Map<number, { km: number; rides: number }>();
  for (const a of rides) {
    const mon = mondayOf(localDayIndex(a.startLocal));
    const prev = totals.get(mon) ?? { km: 0, rides: 0 };
    totals.set(mon, { km: prev.km + a.distanceM / 1000, rides: prev.rides + 1 });
  }

  const first = mondayOf(localDayIndex(rides[0].startLocal));
  const weeks: WeekPoint[] = [];
  for (let mon = first; mon <= thisWeekMonday; mon += 7) {
    const t = totals.get(mon);
    const prevKm = weeks.at(-1)?.distanceKm ?? 0;
    const isCurrentWeek = mon === thisWeekMonday;
    const km = round1(t?.km ?? 0);
    weeks.push({
      monday: mon,
      distanceKm: km,
      rides: t?.rides ?? 0,
      isCurrentWeek,
      ceilingKm: prevKm > 0 ? round1(prevKm * 1.1) : null,
      jump: !isCurrentWeek && prevKm > 0 ? km / prevKm - 1 : null,
    });
  }
  return weeks;
}

export async function getPlannerData(): Promise<PlannerData> {
  const db = getDb();
  const rows = (await db
    .select()
    .from(activities)
    .orderBy(asc(activities.startDate))) as Activity[];

  const rides = rows.filter((a) => isRide(a.sportType));
  if (rides.length === 0) return empty();

  const today = todayIndex();
  const thisWeekMonday = mondayOf(today);
  const weeks = weekSeries(rides, thisWeekMonday);
  const currentWeekKm = weeks.at(-1)?.distanceKm ?? 0;

  // ── Baseline: last COMPLETED week with riding ─────────────────────────
  // A week off doesn't zero the ceiling; we fall back to the last week ridden.
  const completed = weeks.filter((w) => !w.isCurrentWeek);
  const ridden = completed.filter((w) => w.rides > 0);
  const hasBaseline = ridden.length > 0;

  let baselineKm: number;
  if (hasBaseline) {
    baselineKm = ridden[ridden.length - 1].distanceKm;
  } else {
    // No complete week yet — treat current week pace as baseline.
    const daysElapsed = Math.max(1, today - thisWeekMonday + 1);
    baselineKm = (currentWeekKm / daysElapsed) * 7;
  }
  baselineKm = round1(baselineKm);

  const safeTargetKm = round1(baselineKm * 1.1);
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
  let lastWeekJump: PlannerData["lastWeekJump"] = null;

  if (completed.length >= 2) {
    const previousKm = completed[completed.length - 2].distanceKm;
    const lastKm = completed[completed.length - 1].distanceKm;
    if (previousKm > 0) {
      const jump = lastKm / previousKm - 1;
      lastWeekJump = { previousKm, lastKm, jump };
      if (jump > JUMP_WARN) {
        overreach = "caution";
        overreachNote = `Minggu lalu ${Math.round(jump * 100)}% lebih jauh dari minggu sebelumnya. Badan mungkin masih nyesuaiin, jadi minggu ini jaga ritme.`;
      }
    }
  }

  if (safeTargetKm > 0 && currentWeekKm > safeTargetKm * 1.3) {
    overreach = "high";
    overreachNote = `Minggu ini udah ${fmtNum(currentWeekKm)} km, ${Math.round((currentWeekKm / safeTargetKm - 1) * 100)}% di atas batas aman ${fmtNum(safeTargetKm)} km. Ambil hari libur atau putaran pendek dulu sebelum nambah jarak.`;
  } else if (safeTargetKm > 0 && currentWeekKm > safeTargetKm) {
    overreach = "caution";
    overreachNote = `Lo udah sedikit lewat batas aman minggu ini (${fmtNum(safeTargetKm)} km). Masih boleh gowes, asal sisa ride-nya santai dan pendek.`;
  }

  return {
    hasData: true,
    hasBaseline,
    weeks,
    baselineKm,
    safeTargetKm,
    currentWeekKm,
    remainingKm: round1(remainingKm),
    suggestedNextRideKm,
    overreach,
    overreachNote,
    lastWeekJump,
  };
}

function empty(): PlannerData {
  return {
    hasData: false,
    hasBaseline: false,
    weeks: [],
    baselineKm: 0,
    safeTargetKm: 0,
    currentWeekKm: 0,
    remainingKm: 0,
    suggestedNextRideKm: 0,
    overreach: "none",
    overreachNote: null,
    lastWeekJump: null,
  };
}
