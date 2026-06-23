import {
  pgTable,
  bigint,
  text,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  timestamp,
  serial,
} from "drizzle-orm/pg-core";

/**
 * Single-athlete model (no users table). All values stored RAW METRIC
 * (meters, m/s, seconds) — convert only at the display layer.
 */

export const activities = pgTable("activities", {
  // Strava activity id (fits safely in JS number range).
  id: bigint("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  sportType: text("sport_type").notNull(),
  // UTC instant (for ordering) + local wall-clock (for display).
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  startLocal: timestamp("start_local").notNull(),
  distanceM: doublePrecision("distance_m").notNull().default(0),
  movingTimeS: integer("moving_time_s").notNull().default(0),
  elapsedTimeS: integer("elapsed_time_s").notNull().default(0),
  elevationGainM: doublePrecision("elevation_gain_m").notNull().default(0),
  avgSpeedMs: doublePrecision("avg_speed_ms").notNull().default(0),
  maxSpeedMs: doublePrecision("max_speed_ms").notNull().default(0),
  gearId: text("gear_id"),
  prCount: integer("pr_count").notNull().default(0),
  achievementCount: integer("achievement_count").notNull().default(0),
  // Full Strava payload, kept for fields we don't promote to columns yet.
  raw: jsonb("raw"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const gear = pgTable("gear", {
  // Strava gear id, e.g. "b12345678".
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("bike"),
  totalDistanceM: doublePrecision("total_distance_m").notNull().default(0),
  primary: boolean("primary").notNull().default(false),
  retired: boolean("retired").notNull().default(false),
  raw: jsonb("raw"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const maintenance = pgTable("maintenance", {
  id: serial("id").primaryKey(),
  gearId: text("gear_id")
    .notNull()
    .references(() => gear.id, { onDelete: "cascade" }),
  task: text("task").notNull(),
  intervalKm: doublePrecision("interval_km").notNull(),
  // Gear total distance (meters) recorded at the last time this task was done.
  lastDoneDistanceM: doublePrecision("last_done_distance_m").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Single-row table (id always = 1). Caches the live Strava access token and
 * tracks the sync cursor so we fetch only new activities.
 */
export const syncState = pgTable("sync_state", {
  id: integer("id").primaryKey().default(1),
  cachedAccessToken: text("cached_access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  // Latest refresh token (Strava may rotate it); preferred over the env seed.
  refreshToken: text("refresh_token"),
  // Cursor: start_date of the most recent activity we've stored.
  lastActivitySync: timestamp("last_activity_sync", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type Gear = typeof gear.$inferSelect;
export type NewGear = typeof gear.$inferInsert;
export type Maintenance = typeof maintenance.$inferSelect;
export type NewMaintenance = typeof maintenance.$inferInsert;
export type SyncState = typeof syncState.$inferSelect;
