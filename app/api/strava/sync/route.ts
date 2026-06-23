import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { syncActivities } from "@/lib/strava/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pull recent activities from Strava into the DB.
 *
 * Auth: pass the shared secret as `?secret=` or `Authorization: Bearer <secret>`.
 * Vercel Cron requests carry the Authorization header automatically when
 * CRON/SYNC secrets are configured.
 *
 * `?full=1` ignores the cursor and re-pulls everything (one-time backfill).
 */
function authorize(req: NextRequest): boolean {
  const secret = env.syncSecret;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("secret") === secret) return true;
  return false;
}

async function handle(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const full = req.nextUrl.searchParams.get("full") === "1";

  try {
    const result = await syncActivities({ full });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
