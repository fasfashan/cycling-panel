import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bike, Trophy, Star, Camera } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MetricReadout } from "@/components/metric-readout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActivityById } from "@/lib/stats/activities";
import { getActivityPhotos, photoUrl } from "@/lib/strava/photos";
import {
  kmFromMeters,
  kmhFromMs,
  metersRounded,
  durationFromSeconds,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { id: string };

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Pull extra fields that live in the raw JSON blob. */
function rawField(raw: unknown, key: string): unknown {
  if (raw && typeof raw === "object") {
    return (raw as Record<string, unknown>)[key];
  }
  return undefined;
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const idNum = parseInt(id, 10);
  if (isNaN(idNum)) notFound();

  const activity = await getActivityById(idNum);
  if (!activity) notFound();

  // Fetch photos — always try, since photos can be added after initial sync.
  const photos = await getActivityPhotos(idNum, 2000);

  const restTimeS = activity.elapsedTimeS - activity.movingTimeS;
  const elevLow = rawField(activity.raw, "elev_low") as number | undefined;
  const elevHigh = rawField(activity.raw, "elev_high") as number | undefined;
  const kudosCount = rawField(activity.raw, "kudos_count") as number | undefined;
  const timezone = rawField(activity.raw, "timezone") as string | undefined;
  // Strip "(GMT+XX:XX) " prefix to get just "Asia/Jakarta"
  const tzDisplay = timezone?.replace(/^\(GMT[^)]+\)\s*/, "") ?? null;

  const gearName = activity.gear
    ? `${activity.gear.raw
        ? (rawField(activity.gear.raw, "brand_name") as string | undefined) ?? ""
        : ""} ${activity.gear.name}`.trim()
    : null;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        {/* Back link */}
        <Link
          href="/activities"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          All rides
        </Link>

        {/* Header */}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {activity.name}
            </h1>
            <div className="flex items-center gap-2">
              {activity.prCount > 0 ? (
                <span className="flex items-center gap-1 rounded-md bg-pine/10 px-2 py-1 text-xs font-medium text-pine">
                  <Trophy className="size-3" aria-hidden />
                  {activity.prCount} PR{activity.prCount > 1 ? "s" : ""}
                </span>
              ) : null}
              {activity.achievementCount > 0 ? (
                <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  <Star className="size-3" aria-hidden />
                  {activity.achievementCount}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{formatDate(activity.startLocal)} · {formatTime(activity.startLocal)}</span>
            <span className="hidden sm:inline">·</span>
            <span>{activity.sportType}</span>
            {gearName ? (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="flex items-center gap-1">
                  <Bike className="size-3.5" aria-hidden />
                  {gearName}
                </span>
              </>
            ) : null}
            {kudosCount !== undefined && kudosCount > 0 ? (
              <>
                <span className="hidden sm:inline">·</span>
                <span>{kudosCount} kudos</span>
              </>
            ) : null}
          </div>
        </div>

        {/* Hero metrics */}
        <Card>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-6 pt-5 sm:grid-cols-4">
            <MetricReadout
              label="Distance"
              value={kmFromMeters(activity.distanceM)}
              unit="km"
              size="lg"
              accent
            />
            <MetricReadout
              label="Moving time"
              value={durationFromSeconds(activity.movingTimeS)}
              size="lg"
            />
            <MetricReadout
              label="Avg speed"
              value={kmhFromMs(activity.avgSpeedMs)}
              unit="km/h"
              size="lg"
            />
            <MetricReadout
              label="Elevation"
              value={metersRounded(activity.elevationGainM)}
              unit="m"
              size="lg"
            />
          </CardContent>
        </Card>

        {/* Secondary metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              <MetricReadout
                label="Max speed"
                value={kmhFromMs(activity.maxSpeedMs)}
                unit="km/h"
                size="md"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <MetricReadout
                label="Elapsed time"
                value={durationFromSeconds(activity.elapsedTimeS)}
                size="md"
                hint={restTimeS > 60 ? `${durationFromSeconds(restTimeS)} stopped` : undefined}
              />
            </CardContent>
          </Card>
          {elevLow !== undefined && elevHigh !== undefined ? (
            <>
              <Card>
                <CardContent className="pt-5">
                  <MetricReadout
                    label="Min elevation"
                    value={Math.round(elevLow)}
                    unit="m"
                    size="md"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <MetricReadout
                    label="Max elevation"
                    value={Math.round(elevHigh)}
                    unit="m"
                    size="md"
                  />
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Pace breakdown */}
        {restTimeS > 60 ? (
          <Card>
            <CardHeader>
              <CardTitle>Time breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {/* Moving */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="label-readout">Moving</span>
                  <span className="font-mono tabular-nums">
                    {durationFromSeconds(activity.movingTimeS)}
                    {" · "}
                    {Math.round((activity.movingTimeS / activity.elapsedTimeS) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-pine"
                    style={{
                      width: `${(activity.movingTimeS / activity.elapsedTimeS) * 100}%`,
                    }}
                  />
                </div>
              </div>
              {/* Stopped */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="label-readout">Stopped</span>
                  <span className="font-mono tabular-nums">
                    {durationFromSeconds(restTimeS)}
                    {" · "}
                    {Math.round((restTimeS / activity.elapsedTimeS) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-muted-foreground/40"
                    style={{
                      width: `${(restTimeS / activity.elapsedTimeS) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Photos */}
        {photos.length > 0 ? (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Camera className="size-4 text-muted-foreground" aria-hidden />
              <span className="label-readout">
                {photos.length} photo{photos.length > 1 ? "s" : ""}
              </span>
            </div>
            <div
              className={
                photos.length === 1
                  ? "w-full"
                  : "grid grid-cols-2 gap-2"
              }
            >
              {photos.map((photo) => {
                const url = photoUrl(photo);
                if (!url) return null;
                const sizes = Object.values(photo.sizes)[0];
                const isPortrait = sizes ? sizes[1] > sizes[0] : false;
                return (
                  <a
                    key={photo.unique_id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={photo.caption || activity.name}
                      loading="lazy"
                      className={
                        "w-full object-cover " +
                        (photos.length === 1
                          ? isPortrait
                            ? "max-h-[70vh]"
                            : "max-h-[60vh]"
                          : "aspect-square")
                      }
                    />
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Metadata footer */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {tzDisplay ? <span>Timezone: {tzDisplay}</span> : null}
          <span>Activity ID: {activity.id}</span>
          <Link
            href={`https://www.strava.com/activities/${activity.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            View on Strava ↗
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
