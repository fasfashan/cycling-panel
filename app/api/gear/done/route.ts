import { NextRequest, NextResponse } from "next/server";
import { markTaskDone } from "@/lib/stats/gear";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { taskId } = await req.json().catch(() => ({}));
  if (!taskId || typeof taskId !== "number") {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }
  await markTaskDone(taskId);
  return NextResponse.json({ ok: true });
}
