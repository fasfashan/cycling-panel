import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { gear } from "@/lib/db/schema";
import { seedDefaultTasks } from "@/lib/stats/gear";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const db = getDb();
  const gears = await db.select().from(gear);
  for (const g of gears) {
    await seedDefaultTasks(g.id, g.totalDistanceM);
  }
  return NextResponse.json({ ok: true, seeded: gears.map((g) => g.id) });
}
