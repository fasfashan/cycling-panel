import Link from "next/link";
import { ChevronRight, Camera } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { getAllActivities } from "@/lib/stats/activities";
import { kmFromMeters, kmhFromMs, metersRounded, durationFromSeconds } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ActivitiesPage() {
  const rides = await getAllActivities();

  // Group by local month (UTC parts of start_local).
  const groups = new Map<string, typeof rides>();
  for (const a of rides) {
    const key = monthLabel(a.startLocal);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Rides</h1>
          <span className="label-readout">{rides.length} total</span>
        </div>

        {rides.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rides synced yet.</p>
        ) : (
          [...groups.entries()].map(([month, group]) => (
            <section key={month}>
              <span className="label-readout">{month}</span>
              <ul className="mt-2 flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {group.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/activities/${a.id}`}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3.5 transition-colors",
                        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      )}
                    >
                      {/* Date column */}
                      <div className="w-24 shrink-0">
                        <div className="font-mono text-xs tabular-nums text-muted-foreground">
                          {dayLabel(a.startLocal)}
                        </div>
                        <div className="font-mono text-xs tabular-nums text-muted-foreground">
                          {timeLabel(a.startLocal)}
                        </div>
                      </div>

                      {/* Name + stats */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{a.name}</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0">
                          <span className="font-mono text-xs tabular-nums text-pine">
                            {kmFromMeters(a.distanceM)} km
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {kmhFromMs(a.avgSpeedMs)} km/h
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {metersRounded(a.elevationGainM)} m↑
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {durationFromSeconds(a.movingTimeS)}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {a.prCount > 0 ? (
                          <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-pine/10 text-pine">
                            PR
                          </span>
                        ) : null}
                        {((a.raw as Record<string, unknown>)?.total_photo_count as number) > 0 ? (
                          <Camera className="size-3.5 text-muted-foreground/60" aria-label="Has photos" />
                        ) : null}
                      </div>

                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
