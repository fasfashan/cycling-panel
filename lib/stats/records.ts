import { asc } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import type { Activity } from "@/lib/db/schema";

/**
 * Ride-level personal records, Strava style: a ride earns a PR when, at the
 * time it was ridden, it beat every earlier ride in that category. A ride
 * with no earlier ride to beat (the first in a category) earns nothing.
 */

export type RecordKind = "distance" | "elevation" | "speed";

export type SpeedBracket = { minKm: number; maxKm: number; label: string };

/** Avg speed only compares rides of similar length. */
export const SPEED_BRACKETS: SpeedBracket[] = [
  { minKm: 10, maxKm: 20, label: "10–20 km" },
  { minKm: 20, maxKm: 40, label: "20–40 km" },
  { minKm: 40, maxKm: 80, label: "40–80 km" },
  { minKm: 80, maxKm: Infinity, label: "80+ km" },
];

export type RideRecord = {
  kind: RecordKind;
  ride: Activity;
  /** "Ride terjauh", "Rata-rata tercepat 10–20 km", ... */
  title: string;
  value: number;
  unit: "km" | "m" | "km/j";
  /** The record this ride broke. */
  previous: { value: number; ride: Activity };
  bracket?: SpeedBracket;
};

function isRide(sportType: string): boolean {
  return /ride/i.test(sportType);
}

export function speedBracket(distanceM: number): SpeedBracket | null {
  const km = distanceM / 1000;
  return SPEED_BRACKETS.find((b) => km >= b.minKm && km < b.maxKm) ?? null;
}

type Metric = {
  kind: RecordKind;
  /** Category key; speed is split per bracket. */
  key: (a: Activity) => string | null;
  value: (a: Activity) => number;
  unit: RideRecord["unit"];
  title: (a: Activity) => string;
};

const METRICS: Metric[] = [
  {
    kind: "distance",
    key: () => "distance",
    value: (a) => a.distanceM / 1000,
    unit: "km",
    title: () => "Ride terjauh",
  },
  {
    kind: "elevation",
    key: () => "elevation",
    value: (a) => a.elevationGainM,
    unit: "m",
    title: () => "Elevasi terbanyak",
  },
  {
    kind: "speed",
    key: (a) => speedBracket(a.distanceM)?.label ?? null,
    value: (a) => a.avgSpeedMs * 3.6,
    unit: "km/j",
    title: (a) => `Rata-rata tercepat ${speedBracket(a.distanceM)?.label}`,
  },
];

export type RecordBook = {
  /** PRs earned by each ride, keyed by ride id. */
  byRide: Map<number, RideRecord[]>;
  /** Current holder per category, in METRICS / bracket order. */
  current: { title: string; kind: RecordKind; ride: Activity; value: number; unit: RideRecord["unit"] }[];
};

/** Walk rides oldest first, tracking the best so far per category. */
export function buildRecordBook(ridesAsc: Activity[]): RecordBook {
  const best = new Map<string, { value: number; ride: Activity }>();
  const byRide = new Map<number, RideRecord[]>();

  for (const ride of ridesAsc) {
    for (const m of METRICS) {
      const key = m.key(ride);
      if (!key) continue;
      const value = m.value(ride);
      const prev = best.get(key);
      if (!prev || value > prev.value) {
        if (prev) {
          const rec: RideRecord = {
            kind: m.kind,
            ride,
            title: m.title(ride),
            value,
            unit: m.unit,
            previous: prev,
            bracket: m.kind === "speed" ? speedBracket(ride.distanceM) ?? undefined : undefined,
          };
          byRide.set(ride.id, [...(byRide.get(ride.id) ?? []), rec]);
        }
        best.set(key, { value, ride });
      }
    }
  }

  const order = ["distance", "elevation", ...SPEED_BRACKETS.map((b) => b.label)];
  const current = order.flatMap((key) => {
    const b = best.get(key);
    if (!b) return [];
    const m = METRICS.find((x) => x.key(b.ride) === key)!;
    return [{ title: m.title(b.ride), kind: m.kind, ride: b.ride, value: b.value, unit: m.unit }];
  });

  return { byRide, current };
}

export async function getRecordBook(): Promise<RecordBook> {
  const db = getDb();
  const rows = (await db.select().from(activities).orderBy(asc(activities.startDate))) as Activity[];
  return buildRecordBook(rows.filter((a) => isRide(a.sportType)));
}

export async function getRideRecord(rideId: number, kind: RecordKind): Promise<RideRecord | null> {
  const book = await getRecordBook();
  return book.byRide.get(rideId)?.find((r) => r.kind === kind) ?? null;
}

const KINDS: RecordKind[] = ["distance", "elevation", "speed"];
export function isRecordKind(v: string): v is RecordKind {
  return (KINDS as string[]).includes(v);
}

/** Download filename, shared by the route header and the <a download> attribute. */
export function stickerFilename(rideId: number, kind: RecordKind, panel = false): string {
  const slug = { distance: "terjauh", elevation: "elevasi", speed: "tercepat" }[kind];
  return `pr-${slug}-${rideId}${panel ? "-kartu" : ""}.png`;
}

/** PNG sticker URL; `panel` is the dark-card variant for bright photos. */
export function stickerUrl(rec: RideRecord, opts: { panel?: boolean; download?: boolean } = {}): string {
  const q = new URLSearchParams();
  if (opts.panel) q.set("v", "panel");
  if (opts.download) q.set("download", "1");
  const qs = q.toString();
  return `/api/share/pr/${rec.ride.id}/${rec.kind}${qs ? `?${qs}` : ""}`;
}
