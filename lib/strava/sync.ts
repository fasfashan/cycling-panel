import { eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { activities, gear, syncState } from "@/lib/db/schema";
import { listActivities, getActivity, getGear } from "./client";
import { toActivityRow, toGearRow } from "./transform";
import type { NewActivity } from "@/lib/db/schema";

/** Upsert activity rows, updating the changed columns on conflict. */
async function upsertActivities(rows: NewActivity[]) {
  if (rows.length === 0) return;
  const db = getDb();
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
        raw: sql`excluded.raw`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
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

  await upsertActivities(rows);

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
    gearUpdated: gearIds.length,
    latest: latest?.toISOString() ?? null,
  };
}

/** Sync a single activity by id (used by the webhook on create/update). */
export async function syncSingleActivity(id: number) {
  const a = await getActivity(id);
  const row = toActivityRow(a);
  await upsertActivities([row]);
  if (row.gearId) await syncGear([row.gearId]);
  return row;
}

/** Remove an activity (used by the webhook on delete). */
export async function deleteActivity(id: number) {
  const db = getDb();
  await db.delete(activities).where(eq(activities.id, id));
}
