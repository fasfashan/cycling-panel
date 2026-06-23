import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { activities, gear } from "@/lib/db/schema";
import type { Activity, Gear } from "@/lib/db/schema";

export type ActivityWithGear = Activity & { gear: Gear | null };

export async function getAllActivities(): Promise<Activity[]> {
  const db = getDb();
  return (await db
    .select()
    .from(activities)
    .orderBy(desc(activities.startDate))) as Activity[];
}

export async function getActivityById(
  id: number
): Promise<ActivityWithGear | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(activities)
    .leftJoin(gear, eq(activities.gearId, gear.id))
    .where(eq(activities.id, id));

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...(row.activities as Activity),
    gear: (row.gear as Gear | null) ?? null,
  };
}
