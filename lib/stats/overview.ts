import { desc } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import type { Activity } from "@/lib/db/schema";
import { localDayIndex } from "@/lib/format";

// Rider is in Indonesia (WIB, UTC+7, no DST).
const RIDER_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

function isRide(sportType: string): boolean {
  return /ride/i.test(sportType);
}

/** Current rider-local day index (days since epoch, Monday-aware). */
function todayIndex(): number {
  return localDayIndex(new Date(Date.now() + RIDER_TZ_OFFSET_MS));
}

export type OverviewStats = {
  hasData: boolean;
  todayIndex: number;
  totals: {
    distanceM: number;
    rides: number;
    elevationM: number;
    movingTimeS: number;
  };
  streakDays: number;
  /** Rolling 7-day window (last 7 days) vs the previous 7 days. */
  rolling7: {
    distanceM: number;
    rides: number;
    distanceDeltaM: number;
    ridesDelta: number;
  };
  latest: Activity | null;
};

export async function getOverviewStats(): Promise<OverviewStats> {
  const db = getDb();
  const rows = (await db
    .select()
    .from(activities)
    .orderBy(desc(activities.startDate))) as Activity[];

  const rides = rows.filter((a) => isRide(a.sportType));

  const today = todayIndex();

  if (rides.length === 0) {
    return {
      hasData: false,
      todayIndex: today,
      totals: { distanceM: 0, rides: 0, elevationM: 0, movingTimeS: 0 },
      streakDays: 0,
      rolling7: { distanceM: 0, rides: 0, distanceDeltaM: 0, ridesDelta: 0 },
      latest: null,
    };
  }

  const totals = rides.reduce(
    (acc, a) => {
      acc.distanceM += a.distanceM;
      acc.elevationM += a.elevationGainM;
      acc.movingTimeS += a.movingTimeS;
      return acc;
    },
    { distanceM: 0, rides: rides.length, elevationM: 0, movingTimeS: 0 }
  );

  // ── Rolling 7 days vs previous 7 days (rider-local) ───────────────
  // Last 7 days  = [today-6 .. today]; Prev 7 days = [today-13 .. today-7].
  const last7Start = today - 6;
  const prev7Start = today - 13;

  const rolling7 = { distanceM: 0, rides: 0, distanceDeltaM: 0, ridesDelta: 0 };
  let prev7DistanceM = 0;
  let prev7Rides = 0;

  for (const a of rides) {
    const di = localDayIndex(a.startLocal);
    if (di >= last7Start && di <= today) {
      rolling7.distanceM += a.distanceM;
      rolling7.rides += 1;
    } else if (di >= prev7Start && di < last7Start) {
      prev7DistanceM += a.distanceM;
      prev7Rides += 1;
    }
  }
  rolling7.distanceDeltaM = rolling7.distanceM - prev7DistanceM;
  rolling7.ridesDelta = rolling7.rides - prev7Rides;

  // ── Current streak (consecutive ride days, alive if today or yesterday) ──
  const rideDays = new Set(rides.map((a) => localDayIndex(a.startLocal)));
  let anchor: number | null = null;
  if (rideDays.has(today)) anchor = today;
  else if (rideDays.has(today - 1)) anchor = today - 1;

  let streakDays = 0;
  if (anchor !== null) {
    let d = anchor;
    while (rideDays.has(d)) {
      streakDays += 1;
      d -= 1;
    }
  }

  return {
    hasData: true,
    todayIndex: today,
    totals,
    streakDays,
    rolling7,
    latest: rides[0],
  };
}
