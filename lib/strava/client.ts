import { getAccessToken } from "./auth";
import type { StravaActivity, StravaGear } from "./types";

const API_BASE = "https://www.strava.com/api/v3";

async function stravaGet<T>(path: string, params?: Record<string, string | number>) {
  const token = await getAccessToken();
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 429) {
    throw new Error("Strava rate limit hit (429). Backing off.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Strava GET ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

/**
 * List the athlete's activities, newest first. Pass `after` (unix seconds) to
 * fetch only activities started after a cursor — keeps syncs incremental and
 * well under rate limits. Auto-paginates until exhausted.
 */
export async function listActivities(opts: {
  after?: number;
  perPage?: number;
  maxPages?: number;
} = {}): Promise<StravaActivity[]> {
  const perPage = opts.perPage ?? 100;
  const maxPages = opts.maxPages ?? 10; // safety cap (1000 activities)
  const all: StravaActivity[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const batch = await stravaGet<StravaActivity[]>("/athlete/activities", {
      per_page: perPage,
      page,
      ...(opts.after ? { after: opts.after } : {}),
    });
    all.push(...batch);
    if (batch.length < perPage) break; // last page
  }

  return all;
}

/** Fetch a single activity (used by the webhook handler on create/update). */
export function getActivity(id: number) {
  return stravaGet<StravaActivity>(`/activities/${id}`);
}

/** Fetch gear detail (total distance, name) by Strava gear id. */
export function getGear(id: string) {
  return stravaGet<StravaGear>(`/gear/${id}`);
}
