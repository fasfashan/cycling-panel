import { AppShell } from "@/components/app-shell";
import { EmptyState, RideRow, rideDay } from "@/components/panel";
import type { Activity } from "@/lib/db/schema";
import { getAllActivities } from "@/lib/stats/activities";
import { kmFromMeters, localDateLabel, weekRangeLabel } from "@/lib/format";
import { mondayOf } from "@/lib/stats/planner";
import { getRecordBook } from "@/lib/stats/records";

export const dynamic = "force-dynamic";

export default async function RidesPage() {
  const [rides, book] = await Promise.all([getAllActivities(), getRecordBook()]); // rides newest first

  if (rides.length === 0) {
    return (
      <AppShell>
        <EmptyState
          title="Belum ada ride"
          body="Ride dari Strava otomatis masuk ke sini setelah lo upload."
        />
      </AppShell>
    );
  }

  const weeks = new Map<number, Activity[]>();
  for (const r of rides) {
    const mon = mondayOf(rideDay(r));
    if (!weeks.has(mon)) weeks.set(mon, []);
    weeks.get(mon)!.push(r);
  }
  const totalM = rides.reduce((sum, r) => sum + r.distanceM, 0);
  const first = rides[rides.length - 1];

  return (
    <AppShell>
      <h1 className="text-[28px] font-bold tracking-tight">Rides</h1>
      <p className="mt-1 text-sm tabular-nums text-muted-foreground">
        {rides.length} ride · {kmFromMeters(totalM)} km sejak {localDateLabel(first.startLocal)}
      </p>

      {[...weeks.entries()].map(([mon, list]) => (
        <section key={mon} aria-labelledby={`week-${mon}`}>
          <div className="sticky top-14 z-10 -mx-4 mt-6 flex items-baseline justify-between bg-background/95 px-4 py-2 backdrop-blur">
            <h2 id={`week-${mon}`} className="font-sans text-sm font-semibold">
              {weekRangeLabel(mon)}
            </h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {kmFromMeters(list.reduce((sum, r) => sum + r.distanceM, 0))} km · {list.length} ride
            </span>
          </div>
          {list.map((r) => (
            <RideRow key={r.id} ride={r} prCount={book.byRide.get(r.id)?.length ?? 0} />
          ))}
        </section>
      ))}
    </AppShell>
  );
}
