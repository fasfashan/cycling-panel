import { Bike } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MetricReadout } from "@/components/metric-readout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { getOverviewStats } from "@/lib/stats/overview";
import {
  kmFromMeters,
  kmhFromMs,
  metersRounded,
  durationFromSeconds,
  relativeWhen,
} from "@/lib/format";

// Read fresh from our DB on each request. Webhook + SWR revalidation lands later.
export const dynamic = "force-dynamic";

function signed(value: string, direction: "up" | "down" | "flat") {
  if (direction === "up") return `+${value}`;
  if (direction === "down") return `−${value}`;
  return value;
}

export default async function Home() {
  const stats = await getOverviewStats();

  if (!stats.hasData) {
    return (
      <AppShell>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Bike className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-heading text-lg">No rides yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Once your rides sync from Strava, your overview shows up here.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const { totals, rolling7, streakDays, latest, todayIndex } = stats;

  const distDir =
    rolling7.distanceDeltaM > 0 ? "up" : rolling7.distanceDeltaM < 0 ? "down" : "flat";
  const rideDir =
    rolling7.ridesDelta > 0 ? "up" : rolling7.ridesDelta < 0 ? "down" : "flat";

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Hero: this-week readout — the instrument's main screen */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h1 className="font-heading text-xl font-semibold tracking-tight">
              Overview
            </h1>
            <span className="label-readout">last 7 days</span>
          </div>

          <Card>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-6 pt-5 sm:grid-cols-4">
              <MetricReadout
                label="Last 7 days"
                value={kmFromMeters(rolling7.distanceM)}
                unit="km"
                size="lg"
                accent
                delta={{
                  value: `${signed(kmFromMeters(Math.abs(rolling7.distanceDeltaM)), distDir)} km vs prev 7d`,
                  direction: distDir,
                }}
              />
              <MetricReadout
                label="Rides (7 days)"
                value={rolling7.rides}
                size="lg"
                accent
                delta={{
                  value: `${signed(String(Math.abs(rolling7.ridesDelta)), rideDir)} vs prev 7d`,
                  direction: rideDir,
                }}
              />
              <MetricReadout
                label="Current streak"
                value={streakDays}
                unit={streakDays === 1 ? "day" : "days"}
                size="lg"
                hint="Consecutive ride days"
              />
              <MetricReadout
                label="Total moving time"
                value={durationFromSeconds(totals.movingTimeS)}
                size="lg"
              />
            </CardContent>
          </Card>
        </section>

        {/* All-time totals */}
        <section>
          <span className="label-readout">All time</span>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total distance", value: kmFromMeters(totals.distanceM), unit: "km" },
              { label: "Total rides", value: String(totals.rides) },
              { label: "Total elevation", value: metersRounded(totals.elevationM), unit: "m" },
              { label: "Moving time", value: durationFromSeconds(totals.movingTimeS) },
            ].map((m) => (
              <Card key={m.label}>
                <CardContent className="pt-5">
                  <MetricReadout label={m.label} value={m.value} unit={m.unit} size="md" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Latest ride detail */}
        {latest ? (
          <section>
            <Card>
              <CardHeader>
                <CardTitle>Latest ride</CardTitle>
                <CardDescription>
                  {latest.name} · {relativeWhen(latest.startLocal, todayIndex)}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <MetricReadout
                  label="Distance"
                  value={kmFromMeters(latest.distanceM)}
                  unit="km"
                  size="md"
                  accent
                />
                <MetricReadout
                  label="Avg speed"
                  value={kmhFromMs(latest.avgSpeedMs)}
                  unit="km/h"
                  size="md"
                />
                <MetricReadout
                  label="Elevation"
                  value={metersRounded(latest.elevationGainM)}
                  unit="m"
                  size="md"
                />
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
