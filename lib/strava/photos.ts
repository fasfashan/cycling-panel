import { getAccessToken } from "./auth";

export type StravaPhoto = {
  unique_id: string;
  activity_id: number;
  caption: string;
  urls: Record<string, string>; // key = size string, value = URL
  sizes: Record<string, [number, number]>; // key = size string, [w, h]
  created_at_local: string;
  default_photo: boolean;
};

/**
 * Fetch photos for a single activity from Strava.
 * Returns [] if the activity has no photos or on error.
 *
 * @param size - Longest edge in pixels. Strava returns the nearest available.
 *               Use 600 for thumbnails, 2000 for full-size display.
 */
export async function getActivityPhotos(
  activityId: number,
  size: 600 | 2000 = 2000
): Promise<StravaPhoto[]> {
  try {
    const token = await getAccessToken();
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/photos?size=${size}&photo_sources=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as StravaPhoto[]) : [];
  } catch {
    return [];
  }
}

/** Extract the best available URL from a photo object. */
export function photoUrl(photo: StravaPhoto): string | null {
  const keys = Object.keys(photo.urls).sort((a, b) => Number(b) - Number(a));
  return keys.length > 0 ? (photo.urls[keys[0]] ?? null) : null;
}

/** Aspect ratio (w/h) for a photo, defaults to 4/3 if unknown. */
export function photoAspectRatio(photo: StravaPhoto): number {
  const sizes = Object.values(photo.sizes)[0];
  if (sizes && sizes[1] > 0) return sizes[0] / sizes[1];
  return 4 / 3;
}
