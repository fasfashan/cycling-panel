/**
 * Minimal Strava API shapes — only the fields this app consumes.
 * All distances in meters, speeds in m/s, times in seconds (metric).
 * HR / power / cadence are intentionally absent (no sensors).
 */

export type StravaTokenResponse = {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  expires_in: number; // seconds until expiry
};

export type StravaActivity = {
  id: number;
  name: string;
  sport_type: string; // e.g. "Ride", "GravelRide"
  type?: string;
  start_date: string; // ISO 8601 UTC
  start_date_local: string; // ISO 8601 local wall-clock
  timezone?: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  average_speed: number; // m/s
  max_speed: number; // m/s
  gear_id: string | null;
  pr_count?: number;
  achievement_count?: number;
};

export type StravaGear = {
  id: string;
  name?: string;
  nickname?: string;
  brand_name?: string;
  model_name?: string;
  distance: number; // meters
  primary?: boolean;
  retired?: boolean;
};

/** Webhook event payload (POST). */
export type StravaWebhookEvent = {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  updates?: Record<string, string>;
  owner_id: number;
  subscription_id: number;
  event_time: number;
};
