import type { NewActivity, NewGear } from "@/lib/db/schema";
import type { StravaActivity, StravaGear } from "./types";

/** Map a Strava activity payload to a DB row (raw metric, no unit conversion). */
export function toActivityRow(a: StravaActivity): NewActivity {
  return {
    id: a.id,
    name: a.name,
    sportType: a.sport_type ?? a.type ?? "Ride",
    startDate: new Date(a.start_date),
    // start_date_local is wall-clock in the activity's tz; strip the trailing
    // "Z" semantics by parsing as a plain local instant for display use.
    startLocal: new Date(a.start_date_local),
    distanceM: a.distance ?? 0,
    movingTimeS: a.moving_time ?? 0,
    elapsedTimeS: a.elapsed_time ?? 0,
    elevationGainM: a.total_elevation_gain ?? 0,
    avgSpeedMs: a.average_speed ?? 0,
    maxSpeedMs: a.max_speed ?? 0,
    gearId: a.gear_id ?? null,
    prCount: a.pr_count ?? 0,
    achievementCount: a.achievement_count ?? 0,
    raw: a,
    updatedAt: new Date(),
  };
}

/** Map a Strava gear payload to a DB row. */
export function toGearRow(g: StravaGear): NewGear {
  const name =
    g.nickname ||
    g.name ||
    [g.brand_name, g.model_name].filter(Boolean).join(" ") ||
    g.id;
  return {
    id: g.id,
    name,
    type: "bike",
    totalDistanceM: g.distance ?? 0,
    primary: g.primary ?? false,
    retired: g.retired ?? false,
    raw: g,
    updatedAt: new Date(),
  };
}
