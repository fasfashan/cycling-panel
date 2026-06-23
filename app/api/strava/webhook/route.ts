import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { syncSingleActivity, deleteActivity } from "@/lib/strava/sync";
import type { StravaWebhookEvent } from "@/lib/strava/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — Strava subscription validation handshake.
 * Strava sends: hub.mode=subscribe, hub.verify_token=<our token>, hub.challenge=<random>
 * We must echo back hub.challenge to confirm the subscription.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === env.stravaWebhookVerifyToken && challenge) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

/**
 * POST — Strava event delivery.
 * Events: object_type=activity, aspect_type=create|update|delete.
 * We must respond 200 within ~2 seconds; sync is fast (single activity fetch).
 */
export async function POST(req: NextRequest) {
  let event: StravaWebhookEvent;
  try {
    event = (await req.json()) as StravaWebhookEvent;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Only handle activity events — ignore athlete-level events.
  if (event.object_type !== "activity") {
    return NextResponse.json({ ok: true });
  }

  try {
    if (event.aspect_type === "create" || event.aspect_type === "update") {
      await syncSingleActivity(event.object_id);
    } else if (event.aspect_type === "delete") {
      await deleteActivity(event.object_id);
    }
  } catch (err) {
    // Log but don't fail — Strava retries on non-200, which we don't want.
    console.error("[webhook] sync error:", err);
  }

  return NextResponse.json({ ok: true });
}
