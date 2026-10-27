import { asc } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import type { Activity } from "@/lib/db/schema";
import { MEANINGFUL_RIDE_M, speedTrend } from "@/lib/stats/speed";
import type { SpeedTrend } from "@/lib/stats/speed";

/** How many recent rides the speed chart plots. */
const SPEED_POINTS = 20;

function isRide(sportType: string): boolean {
  return /ride/i.test(sportType);
}

export type ProgressData = {
  hasData: boolean;
  firstRide: Activity | null;
  totals: { distanceM: number; rides: number; elevationM: number; movingTimeS: number };
  /** Most recent meaningful rides, oldest first. */
  speedPoints: Activity[];
  speed: SpeedTrend | null;
};

export async function getProgressData(): Promise<ProgressData> {
  const db = getDb();
  const rows = (await db
    .select()
    .from(activities)
    .orderBy(asc(activities.startDate))) as Activity[];

  const rides = rows.filter((a) => isRide(a.sportType));
  const meaningful = rides.filter((a) => a.distanceM >= MEANINGFUL_RIDE_M);

  const totals = rides.reduce(
    (acc, a) => {
      acc.distanceM += a.distanceM;
      acc.elevationM += a.elevationGainM;
      acc.movingTimeS += a.movingTimeS;
      return acc;
    },
    { distanceM: 0, rides: rides.length, elevationM: 0, movingTimeS: 0 }
  );

  return {
    hasData: rides.length > 0,
    firstRide: rides[0] ?? null,
    totals,
    speedPoints: meaningful.slice(-SPEED_POINTS),
    speed: speedTrend(rides),
  };
}
