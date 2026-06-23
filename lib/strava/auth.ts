import { eq } from "drizzle-orm";

import { env } from "@/lib/env";
import { getDb } from "@/lib/db";
import { syncState } from "@/lib/db/schema";
import type { StravaTokenResponse } from "./types";

const TOKEN_URL = "https://www.strava.com/oauth/token";
// Refresh a bit early so an in-flight request never races the 6h expiry.
const EXPIRY_BUFFER_S = 120;

/** Ensure the single sync_state row exists and return it. */
async function loadSyncState() {
  const db = getDb();
  const rows = await db.select().from(syncState).where(eq(syncState.id, 1));
  if (rows[0]) return rows[0];

  const inserted = await db
    .insert(syncState)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];

  const refetch = await db.select().from(syncState).where(eq(syncState.id, 1));
  return refetch[0];
}

/**
 * Returns a valid Strava access token, refreshing via the refresh_token grant
 * when the cached token is missing or near expiry. The live token is cached in
 * sync_state so cold serverless invocations don't refresh on every call.
 *
 * Server-only. The client secret and refresh token never leave this module.
 */
export async function getAccessToken(): Promise<string> {
  const db = getDb();
  const state = await loadSyncState();

  const nowS = Math.floor(Date.now() / 1000);
  const expiresAtS = state.accessTokenExpiresAt
    ? Math.floor(state.accessTokenExpiresAt.getTime() / 1000)
    : 0;

  if (state.cachedAccessToken && expiresAtS - EXPIRY_BUFFER_S > nowS) {
    return state.cachedAccessToken;
  }

  // Prefer the most recently stored refresh token; fall back to the env seed.
  const refreshToken = state.refreshToken ?? env.stravaRefreshToken;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.stravaClientId,
      client_secret: env.stravaClientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Strava token refresh failed (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const token = (await res.json()) as StravaTokenResponse;

  await db
    .update(syncState)
    .set({
      cachedAccessToken: token.access_token,
      accessTokenExpiresAt: new Date(token.expires_at * 1000),
      // Persist the (possibly rotated) refresh token for next time.
      refreshToken: token.refresh_token,
      updatedAt: new Date(),
    })
    .where(eq(syncState.id, 1));

  return token.access_token;
}
