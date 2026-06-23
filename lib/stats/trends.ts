import { asc } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import type { Activity } from "@/lib/db/schema";
import { localDayIndex } from "@/lib/format";

const RIDER_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

function isRide(sportType: string): boolean {
  return /ride/i.test(sportType);
}

function mondayOfDay(dayIndex: number): number {
  const dow = new Date(dayIndex * 86_400_000).getUTCDay();
  const offset = (dow + 6) % 7;
  return dayIndex - offset;
}

function isoWeekLabel(mondayDayIndex: number): string {
  const d = new Date(mondayDayIndex * 86_400_000);
  return d.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  });
}

export type WeeklyBucket = {
  weekLabel: string; // "16 Jun"
  distanceKm: number;
  rides: number;
};

export type SpeedPoint = {
  dateLabel: string; // "20 Jun"
  avgSpeedKmh: number;
  distanceKm: number; // for tooltip context
};

export type ElevationPoint = {
  dateLabel: string;
  cumulativeElevationM: number;
};

export type PersonalRecords = {
  longestRide: Activity | null;
  fastestRide: Activity | null;
  biggestClimb: Activity | null;
};

export type TrendsData = {
  weeklyDistance: WeeklyBucket[];
  speedProgression: SpeedPoint[];
  cumulativeElevation: ElevationPoint[];
  prs: PersonalRecords;
};

export async function getTrendsData(): Promise<TrendsData> {
  const db = getDb();
  const rows = (await db
    .select()
    .from(activities)
    .orderBy(asc(activities.startDate))) as Activity[];

  const rides = rows.filter((a) => isRide(a.sportType));

  if (rides.length === 0) {
    return {
      weeklyDistance: [],
      speedProgression: [],
      cumulativeElevation: [],
      prs: { longestRide: null, fastestRide: null, biggestClimb: null },
    };
  }

  // ── Weekly distance bar chart ────────────────────────────────────
  const weekMap = new Map<number, WeeklyBucket>();
  for (const a of rides) {
    const monday = mondayOfDay(localDayIndex(a.startLocal));
    if (!weekMap.has(monday)) {
      weekMap.set(monday, {
        weekLabel: isoWeekLabel(monday),
        distanceKm: 0,
        rides: 0,
      });
    }
    const b = weekMap.get(monday)!;
    b.distanceKm = Math.round((b.distanceKm + a.distanceM / 1000) * 10) / 10;
    b.rides += 1;
  }
  const weeklyDistance = [...weekMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v);

  // ── Speed progression line chart ─────────────────────────────────
  // Only rides with meaningful distance (>= 1 km) to avoid distorted blips.
  const speedProgression: SpeedPoint[] = rides
    .filter((a) => a.distanceM >= 1000 && a.avgSpeedMs > 0)
    .map((a) => ({
      dateLabel: a.startLocal.toLocaleDateString("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
      }),
      avgSpeedKmh: Math.round(a.avgSpeedMs * 3.6 * 10) / 10,
      distanceKm: Math.round((a.distanceM / 1000) * 10) / 10,
    }));

  // ── Cumulative elevation line chart ──────────────────────────────
  let cumElevM = 0;
  const cumulativeElevation: ElevationPoint[] = rides.map((a) => {
    cumElevM += a.elevationGainM;
    return {
      dateLabel: a.startLocal.toLocaleDateString("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
      }),
      cumulativeElevationM: Math.round(cumElevM),
    };
  });

  // ── Auto-detected PRs ─────────────────────────────────────────────
  const qualifiedRides = rides.filter((a) => a.distanceM >= 1000);
  const longestRide =
    qualifiedRides.reduce<Activity | null>(
      (best, a) => (!best || a.distanceM > best.distanceM ? a : best),
      null
    );
  const fastestRide =
    qualifiedRides.reduce<Activity | null>(
      (best, a) => (!best || a.avgSpeedMs > best.avgSpeedMs ? a : best),
      null
    );
  const biggestClimb =
    qualifiedRides.reduce<Activity | null>(
      (best, a) => (!best || a.elevationGainM > best.elevationGainM ? a : best),
      null
    );

  // Current-day offset for timezone (used only in getTrendsData callers if needed).
  void (Date.now() + RIDER_TZ_OFFSET_MS);

  return {
    weeklyDistance,
    speedProgression,
    cumulativeElevation,
    prs: { longestRide, fastestRide, biggestClimb },
  };
}
