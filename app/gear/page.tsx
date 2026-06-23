import { Wrench, Bike, AlertTriangle, CheckCircle } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MetricReadout } from "@/components/metric-readout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { MarkDoneButton } from "@/components/gear/mark-done-button";
import { getGearWithMaintenance } from "@/lib/stats/gear";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function ProgressBar({
  progress,
  overdue,
}: {
  progress: number;
  overdue: boolean;
}) {
  const pct = Math.min(progress * 100, 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          overdue ? "bg-warn" : progress > 0.8 ? "bg-warn/60" : "bg-pine"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function rawField(raw: unknown, key: string): unknown {
  if (raw && typeof raw === "object") {
    return (raw as Record<string, unknown>)[key];
  }
  return undefined;
}

export default async function GearPage() {
  const gears = await getGearWithMaintenance();

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Gear & Maintenance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Distance-based service reminders for your bike.
          </p>
        </div>

        {gears.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Bike className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-heading text-lg">No gear synced yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Gear is pulled from Strava automatically when activities sync.
              </p>
            </CardContent>
          </Card>
        ) : (
          gears.map((g) => {
            const brand = rawField(g.raw, "brand_name") as string | undefined;
            const model = rawField(g.raw, "model_name") as string | undefined;
            const overdueCount = g.tasks.filter((t) => t.overdue).length;

            return (
              <div key={g.id} className="flex flex-col gap-4">
                {/* Bike card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Bike className="size-5 text-pine" aria-hidden />
                        <div>
                          <CardTitle>{g.name}</CardTitle>
                          {brand || model ? (
                            <CardDescription>
                              {[brand, model].filter(Boolean).join(" ")}
                            </CardDescription>
                          ) : null}
                        </div>
                      </div>
                      {overdueCount > 0 ? (
                        <span className="flex items-center gap-1 rounded-md bg-warn/10 px-2 py-1 text-xs font-medium text-warn">
                          <AlertTriangle className="size-3" aria-hidden />
                          {overdueCount} overdue
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-md bg-pine/10 px-2 py-1 text-xs font-medium text-pine">
                          <CheckCircle className="size-3" aria-hidden />
                          All good
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <MetricReadout
                      label="Total distance on this bike"
                      value={g.totalDistanceKm}
                      unit="km"
                      size="md"
                    />
                  </CardContent>
                </Card>

                {/* Maintenance tasks */}
                {g.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No maintenance tasks yet.{" "}
                    <button
                      onClick={async () => {
                        await fetch("/api/gear/seed", { method: "POST" });
                        window.location.reload();
                      }}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Set up defaults
                    </button>
                  </p>
                ) : (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Wrench className="size-4 text-muted-foreground" aria-hidden />
                        <CardTitle>Service schedule</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col divide-y divide-border -mx-0">
                      {g.tasks.map((task) => (
                        <div
                          key={task.id}
                          className={cn(
                            "flex flex-col gap-2 px-5 py-4",
                            task.overdue && "bg-warn/5"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {task.overdue ? (
                                <AlertTriangle className="size-3.5 shrink-0 text-warn" aria-hidden />
                              ) : (
                                <CheckCircle className="size-3.5 shrink-0 text-pine/50" aria-hidden />
                              )}
                              <span
                                className={cn(
                                  "text-sm font-medium",
                                  task.overdue && "text-warn"
                                )}
                              >
                                {task.task}
                              </span>
                            </div>
                            <MarkDoneButton taskId={task.id} />
                          </div>

                          <ProgressBar
                            progress={task.progress}
                            overdue={task.overdue}
                          />

                          <div className="flex justify-between">
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              {task.kmSinceService} km since last service
                            </span>
                            <span
                              className={cn(
                                "font-mono text-xs tabular-nums",
                                task.overdue ? "text-warn" : "text-muted-foreground"
                              )}
                            >
                              {task.overdue
                                ? `${Math.round((task.kmSinceService - task.intervalKm) * 10) / 10} km overdue`
                                : `${task.kmUntilNext} km until next`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
