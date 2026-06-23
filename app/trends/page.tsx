import { TrendingUp, Zap, Mountain, Trophy } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MetricReadout } from "@/components/metric-readout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  WeeklyDistanceChart,
  SpeedProgressionChart,
  CumulativeElevationChart,
} from "@/components/charts/trend-charts";
import { getTrendsData } from "@/lib/stats/trends";
import { kmFromMeters, kmhFromMs, metersRounded } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const { weeklyDistance, speedProgression, cumulativeElevation, prs } =
    await getTrendsData();

  const { longestRide, fastestRide, biggestClimb } = prs;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Progression & Trends
        </h1>

        {/* Weekly distance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-pine" aria-hidden />
              <CardTitle>Weekly distance</CardTitle>
            </div>
            <CardDescription>km per week (Monday–Sunday)</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyDistanceChart data={weeklyDistance} />
          </CardContent>
        </Card>

        {/* Speed progression */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-pine" aria-hidden />
              <CardTitle>Speed progression</CardTitle>
            </div>
            <CardDescription>Average speed per ride (km/h)</CardDescription>
          </CardHeader>
          <CardContent>
            <SpeedProgressionChart data={speedProgression} />
          </CardContent>
        </Card>

        {/* Cumulative elevation */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mountain className="size-4 text-muted-foreground" aria-hidden />
              <CardTitle>Cumulative elevation</CardTitle>
            </div>
            <CardDescription>Total meters climbed over all rides</CardDescription>
          </CardHeader>
          <CardContent>
            <CumulativeElevationChart data={cumulativeElevation} />
          </CardContent>
        </Card>

        {/* Auto-detected PRs */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="size-4 text-pine" aria-hidden />
            <span className="font-heading text-base font-medium">Personal records</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Longest ride</CardTitle>
                {longestRide ? (
                  <CardDescription>
                    {longestRide.name} ·{" "}
                    {longestRide.startLocal.toLocaleDateString("en-GB", {
                      timeZone: "UTC",
                      day: "2-digit",
                      month: "short",
                    })}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                {longestRide ? (
                  <MetricReadout
                    label="Distance"
                    value={kmFromMeters(longestRide.distanceM)}
                    unit="km"
                    size="md"
                    accent
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">No data yet</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fastest ride</CardTitle>
                {fastestRide ? (
                  <CardDescription>
                    {fastestRide.name} ·{" "}
                    {fastestRide.startLocal.toLocaleDateString("en-GB", {
                      timeZone: "UTC",
                      day: "2-digit",
                      month: "short",
                    })}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                {fastestRide ? (
                  <MetricReadout
                    label="Avg speed"
                    value={kmhFromMs(fastestRide.avgSpeedMs)}
                    unit="km/h"
                    size="md"
                    accent
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">No data yet</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Biggest climb</CardTitle>
                {biggestClimb ? (
                  <CardDescription>
                    {biggestClimb.name} ·{" "}
                    {biggestClimb.startLocal.toLocaleDateString("en-GB", {
                      timeZone: "UTC",
                      day: "2-digit",
                      month: "short",
                    })}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                {biggestClimb ? (
                  <MetricReadout
                    label="Elevation"
                    value={metersRounded(biggestClimb.elevationGainM)}
                    unit="m"
                    size="md"
                    accent
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">No data yet</span>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
