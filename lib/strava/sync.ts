import { and, desc, eq, gte, isNull, notInArray, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { activities, gear, syncState } from "@/lib/db/schema";
import { listActivities, getActivity, getGear } from "./client";
import { toActivityRow, toGearRow } from "./transform";
import type { NewActivity } from "@/lib/db/schema";

/** Rides younger than this get their detail re-fetched while RPE is empty. */
const RPE_REFRESH_DAYS = 7;
/** Cap on detail fetches per sync run, to stay far below Strava rate limits. */
const MAX_DETAIL_FETCHES = 25;
const DETAIL_CONCURRENCY = 5;

/**
 * Upsert activity rows, updating the changed columns on conflict.
 *
 * `source` says which Strava endpoint produced the rows. Only the detail
 * endpoint carries perceived_exertion (and description), so a "summary"
 * upsert merges into the stored raw JSON instead of replacing it and leaves
 * `rpe` untouched.
 */
async function upsertActivities(
  rows: NewActivity[],
  source: "summary" | "detail"
) {
  if (rows.length === 0) return;
  const db = getDb();
  const isDetail = source === "detail";
  await db
    .insert(activities)
    .values(rows)
    .onConflictDoUpdate({
      target: activities.id,
      set: {
        name: sql`excluded.name`,
        sportType: sql`excluded.sport_type`,
        startDate: sql`excluded.start_date`,
        startLocal: sql`excluded.start_local`,
        distanceM: sql`excluded.distance_m`,
        movingTimeS: sql`excluded.moving_time_s`,
        elapsedTimeS: sql`excluded.elapsed_time_s`,
        elevationGainM: sql`excluded.elevation_gain_m`,
        avgSpeedMs: sql`excluded.avg_speed_ms`,
        maxSpeedMs: sql`excluded.max_speed_ms`,
        gearId: sql`excluded.gear_id`,
        prCount: sql`excluded.pr_count`,
        achievementCount: sql`excluded.achievement_count`,
        ...(isDetail ? { rpe: sql`excluded.rpe` } : {}),
        raw: isDetail
          ? sql`excluded.raw`
          : sql`coalesce(${activities.raw}, '{}'::jsonb) || excluded.raw`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

/**
 * Re-fetch the detail payload for rides that need it: the ones just listed,
 * recent rides whose RPE is still empty (Strava sends no webhook when only
 * Perceived Exertion is edited), and older rows that only ever got the
 * summary payload. Capped per run; leftovers are picked up by the next sync.
 */
async function refreshDetails(newIds: number[]) {
  const db = getDb();
  const since = new Date(Date.now() - RPE_REFRESH_DAYS * 86_400_000);

  const stale = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        newIds.length > 0 ? notInArray(activities.id, newIds) : undefined,
        or(
          and(gte(activities.startDate, since), isNull(activities.rpe)),
          sql`not (coalesce(${activities.raw}, '{}'::jsonb) ? 'description')`
        )
      )
    )
    .orderBy(desc(activities.startDate))
    .limit(MAX_DETAIL_FETCHES);

  const ids = [...newIds, ...stale.map((r) => r.id)].slice(0, MAX_DETAIL_FETCHES);

  let refreshed = 0;
  for (let i = 0; i < ids.length; i += DETAIL_CONCURRENCY) {
    const batch = ids.slice(i, i + DETAIL_CONCURRENCY);
    const results = await Promise.allSettled(batch.map((id) => getActivity(id)));
    const rows = results.flatMap((r) =>
      r.status === "fulfilled" ? [toActivityRow(r.value)] : []
    );
    await upsertActivities(rows, "detail");
    refreshed += rows.length;
  }
  return refreshed;
}

/** Fetch + upsert gear for the given ids (skips ones we can't resolve). */
async function syncGear(gearIds: string[]) {
  const db = getDb();
  for (const id of gearIds) {
    try {
      const g = await getGear(id);
      await db
        .insert(gear)
        .values(toGearRow(g))
        .onConflictDoUpdate({
          target: gear.id,
          set: {
            name: sql`excluded.name`,
            totalDistanceM: sql`excluded.total_distance_m`,
            primary: sql`excluded.primary`,
            retired: sql`excluded.retired`,
            raw: sql`excluded.raw`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    } catch {
      // Gear that can't be fetched (deleted/forbidden) shouldn't fail the sync.
    }
  }
}

async function advanceCursor(latest: Date | null) {
  if (!latest) return;
  const db = getDb();
  await db
    .update(syncState)
    .set({ lastActivitySync: latest, updatedAt: new Date() })
    .where(eq(syncState.id, 1));
}

/**
 * Incremental sync: pull activities created after the stored cursor, upsert
 * them and their gear, then advance the cursor. Pass `full: true` to ignore
 * the cursor and re-pull everything (one-time backfill).
 */
export async function syncActivities(opts: { full?: boolean } = {}) {
  const db = getDb();
  const stateRows = await db
    .select()
    .from(syncState)
    .where(eq(syncState.id, 1));
  const cursor = opts.full ? undefined : stateRows[0]?.lastActivitySync ?? undefined;
  const after = cursor ? Math.floor(cursor.getTime() / 1000) : undefined;

  const fetched = await listActivities({ after });
  const rows = fetched.map(toActivityRow);

  await upsertActivities(rows, "summary");
  const detailsRefreshed = await refreshDetails(rows.map((r) => r.id));

  const gearIds = [
    ...new Set(rows.map((r) => r.gearId).filter((g): g is string => !!g)),
  ];
  await syncGear(gearIds);

  const latest = rows.reduce<Date | null>((max, r) => {
    const d = r.startDate as Date;
    return !max || d > max ? d : max;
  }, null);
  await advanceCursor(latest);

  return {
    fetched: fetched.length,
    detailsRefreshed,
    gearUpdated: gearIds.length,
    latest: latest?.toISOString() ?? null,
  };
}

/** Sync a single activity by id (used by the webhook on create/update). */
export async function syncSingleActivity(id: number) {
  const a = await getActivity(id);
  const row = toActivityRow(a);
  await upsertActivities([row], "detail");
  if (row.gearId) await syncGear([row.gearId]);
  return row;
}

/** Remove an activity (used by the webhook on delete). */
export async function deleteActivity(id: number) {
  const db = getDb();
  await db.delete(activities).where(eq(activities.id, id));
}
