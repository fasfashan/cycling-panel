import { NextResponse } from "next/server";

import { generatePlannerCoachBrief } from "@/lib/stats/coach-brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const brief = await generatePlannerCoachBrief();
    return NextResponse.json({ ok: true, brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : "coach brief failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
