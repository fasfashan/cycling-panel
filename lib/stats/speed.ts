import type { Activity } from "@/lib/db/schema";

/** Rides under this distance are errands and don't count toward speed trends. */
export const MEANINGFUL_RIDE_M = 3000;
const WINDOW = 5;

export type SpeedTrend = {
  /** Mean avg speed (km/h) of the last 5 meaningful rides. */
  recentKmh: number;
  /** Mean avg speed (km/h) of the 5 rides before that. */
  previousKmh: number;
  deltaKmh: number;
};

function meanKmh(rides: Activity[]): number {
  return rides.reduce((sum, a) => sum + a.avgSpeedMs * 3.6, 0) / rides.length;
}

/**
 * Mean of the last 5 meaningful rides vs the 5 before. Shared by the coach
 * (Hari ini) and Progres so both screens always report the same number.
 * Expects rides in ascending start order. Null until there are 10 rides.
 */
export function speedTrend(rides: Activity[]): SpeedTrend | null {
  const meaningful = rides.filter((a) => a.distanceM >= MEANINGFUL_RIDE_M);
  if (meaningful.length < WINDOW * 2) return null;
  const recentKmh = meanKmh(meaningful.slice(-WINDOW));
  const previousKmh = meanKmh(meaningful.slice(-WINDOW * 2, -WINDOW));
  return {
    recentKmh: Math.round(recentKmh * 10) / 10,
    previousKmh: Math.round(previousKmh * 10) / 10,
    deltaKmh: Math.round((recentKmh - previousKmh) * 10) / 10,
  };
}
