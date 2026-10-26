import type { Activity } from "@/lib/db/schema";
import type { LatLng } from "@/lib/polyline";
import { getActivityById } from "@/lib/stats/activities";

/**
 * Segment PRs read from the stored detail payload (segment_efforts only comes
 * from GET /activities/{id}). Effort ids exceed 2^53 and were already rounded
 * by JSON.parse at sync time, so a PR is addressed by ride id + array index.
 */

type RawEffort = {
  name?: string;
  pr_rank?: number | null;
  elapsed_time?: number;
  distance?: number;
  start_date_local?: string;
  segment?: {
    average_grade?: number;
    climb_category?: number;
    start_latlng?: LatLng | [];
    end_latlng?: LatLng | [];
  };
};

export type SegmentPr = {
  activityId: number;
  /** Position in the ride's segment_efforts array. */
  index: number;
  segmentName: string;
  elapsedS: number;
  distanceM: number;
  avgKmh: number;
  gradePct: number;
  /** Local wall-clock date of the effort. */
  date: Date;
  start: LatLng | null;
  end: LatLng | null;
};

function latLng(v: LatLng | [] | undefined): LatLng | null {
  return Array.isArray(v) && v.length === 2 ? (v as LatLng) : null;
}

function efforts(ride: Activity): RawEffort[] {
  const raw = ride.raw as { segment_efforts?: RawEffort[] } | null;
  return Array.isArray(raw?.segment_efforts) ? raw.segment_efforts : [];
}

/** Rank-1 segment efforts of a ride, in ride order. */
export function ridePrs(ride: Activity): SegmentPr[] {
  return efforts(ride).flatMap((e, index) => {
    if (e.pr_rank !== 1 || !e.elapsed_time || !e.distance) return [];
    return [
      {
        activityId: ride.id,
        index,
        segmentName: e.name ?? "Segmen",
        elapsedS: e.elapsed_time,
        distanceM: e.distance,
        avgKmh: (e.distance / e.elapsed_time) * 3.6,
        gradePct: e.segment?.average_grade ?? 0,
        date: e.start_date_local ? new Date(e.start_date_local) : ride.startLocal,
        start: latLng(e.segment?.start_latlng),
        end: latLng(e.segment?.end_latlng),
      },
    ];
  });
}

export function routePolyline(ride: Activity): string | null {
  const raw = ride.raw as { map?: { summary_polyline?: string | null } } | null;
  return raw?.map?.summary_polyline || null;
}

/** One PR plus the ride it belongs to, for rendering a sticker. */
export async function getSegmentPr(activityId: number, index: number) {
  const ride = await getActivityById(activityId);
  if (!ride) return null;
  const pr = ridePrs(ride).find((p) => p.index === index);
  return pr ? { pr, ride, polyline: routePolyline(ride) } : null;
}

/** PNG sticker URL; `panel` is the dark-card variant for bright photos. */
export function stickerUrl(pr: SegmentPr, opts: { panel?: boolean; download?: boolean } = {}): string {
  const q = new URLSearchParams();
  if (opts.panel) q.set("v", "panel");
  if (opts.download) q.set("download", "1");
  const qs = q.toString();
  return `/api/share/pr/${pr.activityId}/${pr.index}${qs ? `?${qs}` : ""}`;
}

/** "2:55" / "1:04:12". */
export function effortTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
