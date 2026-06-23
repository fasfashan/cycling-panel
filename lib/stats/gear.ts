import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { gear, maintenance } from "@/lib/db/schema";
import type { Gear, Maintenance } from "@/lib/db/schema";

export type MaintenanceWithStatus = Maintenance & {
  kmSinceService: number;
  kmUntilNext: number;
  /** 0–1 progress toward interval. >1 means overdue. */
  progress: number;
  overdue: boolean;
};

export type GearWithMaintenance = Gear & {
  totalDistanceKm: number;
  tasks: MaintenanceWithStatus[];
};

export async function getGearWithMaintenance(): Promise<GearWithMaintenance[]> {
  const db = getDb();
  const gears = (await db.select().from(gear)) as Gear[];
  const allTasks = (await db.select().from(maintenance)) as Maintenance[];

  return gears.map((g) => {
    const tasks = allTasks
      .filter((t) => t.gearId === g.id)
      .map((t) => {
        const kmSinceService =
          (g.totalDistanceM - t.lastDoneDistanceM) / 1000;
        const kmUntilNext = Math.max(0, t.intervalKm - kmSinceService);
        const progress = t.intervalKm > 0 ? kmSinceService / t.intervalKm : 0;
        return {
          ...t,
          kmSinceService: Math.round(kmSinceService * 10) / 10,
          kmUntilNext: Math.round(kmUntilNext * 10) / 10,
          progress,
          overdue: progress >= 1,
        };
      })
      .sort((a, b) => b.progress - a.progress); // most urgent first

    return {
      ...g,
      totalDistanceKm: Math.round((g.totalDistanceM / 1000) * 10) / 10,
      tasks,
    };
  });
}

/** Seed default maintenance tasks for a gear if none exist yet. */
export async function seedDefaultTasks(gearId: string, currentDistanceM: number) {
  const db = getDb();
  const existing = await db
    .select()
    .from(maintenance)
    .where(eq(maintenance.gearId, gearId));

  if (existing.length > 0) return; // already seeded

  const defaults = [
    { task: "Chain lube", intervalKm: 150 },
    { task: "Drivetrain clean", intervalKm: 500 },
    { task: "Tire pressure check", intervalKm: 100 },
    { task: "Chain wear check", intervalKm: 1000 },
    { task: "Brake pad check", intervalKm: 1500 },
    { task: "Full service", intervalKm: 3000 },
  ];

  await db.insert(maintenance).values(
    defaults.map((d) => ({
      gearId,
      task: d.task,
      intervalKm: d.intervalKm,
      // Treat current distance as the last-done point so first reminders
      // fire naturally from today forward.
      lastDoneDistanceM: currentDistanceM,
    }))
  );
}

/** Mark a task as done at the gear's current total distance. */
export async function markTaskDone(taskId: number) {
  const db = getDb();
  const tasks = await db
    .select({ gearId: maintenance.gearId })
    .from(maintenance)
    .where(eq(maintenance.id, taskId));
  if (tasks.length === 0) return;

  const gearRow = await db
    .select({ totalDistanceM: gear.totalDistanceM })
    .from(gear)
    .where(eq(gear.id, tasks[0].gearId));
  if (gearRow.length === 0) return;

  await db
    .update(maintenance)
    .set({
      lastDoneDistanceM: gearRow[0].totalDistanceM,
      updatedAt: new Date(),
    })
    .where(eq(maintenance.id, taskId));
}
