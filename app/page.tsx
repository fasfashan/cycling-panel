import Link from "next/link";
import { Bike, ChevronRight } from "lucide-react";

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
import { getActivityPhotos, photoUrl } from "@/lib/strava/photos";
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

  // Fetch photos for the latest ride (size 600 = thumbnail).
  const latestPhotos = latest ? await getActivityPhotos(latest.id, 600) : [];

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
            <div className="mb-2 flex items-baseline justify-between">
              <span className="label-readout">Latest ride</span>
              <Link
                href="/activities"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                All rides →
              </Link>
            </div>
            <Link href={`/activities/${latest.id}`} className="group block">
              <Card className="transition-colors group-hover:border-border/80 group-hover:bg-muted/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{latest.name}</CardTitle>
                      <CardDescription>
                        {relativeWhen(latest.startLocal, todayIndex)}
                      </CardDescription>
                    </div>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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

                {latestPhotos.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto px-5 pb-5">
                    {latestPhotos.map((photo) => {
                      const url = photoUrl(photo);
                      if (!url) return null;
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={photo.unique_id}
                          src={url}
                          alt={photo.caption || latest.name}
                          loading="lazy"
                          className="size-20 shrink-0 rounded-md object-cover sm:size-24"
                        />
                      );
                    })}
                  </div>
                ) : null}
              </Card>
            </Link>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
