import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { EmptyState, SectionTitle, WeekChart } from "@/components/panel";
import type { Activity } from "@/lib/db/schema";
import {
  durationFromSeconds,
  fmtNum,
  kmFromMeters,
  localDateLabel,
  metersRounded,
} from "@/lib/format";
import { getPlannerData } from "@/lib/stats/planner";
import { getRecordBook } from "@/lib/stats/records";
import { getProgressData } from "@/lib/stats/trends";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function RecordRow({ label, ride, value, unit }: { label: string; ride: Activity; value: string; unit: string }) {
  return (
    <Link
      href={`/activities/${ride.id}`}
      className="flex w-full items-center justify-between gap-3 border-b border-line py-3.5 last:border-0"
    >
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate text-sm">
          {ride.name} · {localDateLabel(ride.startLocal)}
        </span>
      </span>
      <span className="shrink-0 font-heading text-xl font-semibold tabular-nums">
        {value}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </span>
    </Link>
  );
}

function SpeedChart({ points, avgKmh }: { points: Activity[]; avgKmh: number }) {
  const W = 360;
  const H = 120;
  const speeds = points.map((p) => p.avgSpeedMs * 3.6);
  const lo = Math.floor(Math.min(...speeds) - 1);
  const hi = Math.ceil(Math.max(...speeds) + 1);
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * (H - 16) - 8;
  const xy = speeds.map((s, i) => [(i / Math.max(1, speeds.length - 1)) * (W - 16) + 8, y(s)]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Kecepatan rata-rata per ride, ${points.length} ride terakhir, rata-rata ${fmtNum(avgKmh)} km/j`}
    >
      <line x1="0" x2={W} y1={y(avgKmh)} y2={y(avgKmh)} stroke="var(--line)" strokeDasharray="4 4" strokeWidth="1.5" />
      <polyline
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2"
        strokeLinejoin="round"
        points={xy.map((p) => p.join(",")).join(" ")}
      />
      {xy.map(([cx, cy], i) => {
        const last = i === xy.length - 1;
        return (
          <circle
            key={points[i].id}
            cx={cx}
            cy={cy}
            r={last ? 4 : 2.5}
            fill={last ? "var(--brand)" : "var(--surface)"}
            stroke="var(--brand)"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}

export default async function ProgressPage() {
  const [data, planner, book] = await Promise.all([getProgressData(), getPlannerData(), getRecordBook()]);

  if (!data.hasData || !data.firstRide) {
    return (
      <AppShell>
        <EmptyState title="Belum ada progres" body="Butuh minimal satu ride buat mulai ngitung progres." />
      </AppShell>
    );
  }

  const { totals, speedPoints, speed } = data;
  const avgKmh = speedPoints.reduce((s, p) => s + p.avgSpeedMs * 3.6, 0) / Math.max(1, speedPoints.length);

  return (
    <AppShell>
      <h1 className="text-[28px] font-bold tracking-tight">Progres</h1>
      <p className="text-sm text-muted-foreground">Sejak ride pertama, {localDateLabel(data.firstRide.startLocal)}</p>

      <p className="mt-5 flex items-baseline gap-2">
        <span className="num-hero text-[56px] font-semibold leading-none">{kmFromMeters(totals.distanceM, 0)}</span>
        <span className="text-lg text-muted-foreground">km total</span>
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-line text-center tabular-nums">
        <div className="bg-surface py-3">
          <dt className="text-[11px] text-muted-foreground">Ride</dt>
          <dd className="mt-0.5 font-semibold">{totals.rides}</dd>
        </div>
        <div className="bg-surface py-3">
          <dt className="text-[11px] text-muted-foreground">Naik</dt>
          <dd className="mt-0.5 font-semibold">{metersRounded(totals.elevationM)} m</dd>
        </div>
        <div className="bg-surface py-3">
          <dt className="text-[11px] text-muted-foreground">Waktu gowes</dt>
          <dd className="mt-0.5 font-semibold">{durationFromSeconds(totals.movingTimeS)}</dd>
        </div>
      </dl>

      <SectionTitle title="Rekor lo" />
      <div className="rounded-lg bg-surface px-4">
        {book.current.map((r) => (
          <RecordRow
            key={r.title}
            label={r.title}
            ride={r.ride}
            value={r.kind === "elevation" ? metersRounded(r.value) : fmtNum(r.value)}
            unit={r.unit}
          />
        ))}
      </div>

      <SectionTitle title="Jarak per minggu" aside="12 minggu terakhir" />
      <div className="rounded-lg bg-surface px-3 pb-3 pt-4">
        <WeekChart weeks={planner.weeks.slice(-12)} showSafety={false} height={110} />
      </div>

      {speedPoints.length >= 2 ? (
        <>
          <SectionTitle title="Makin cepat nggak?" aside={`${speedPoints.length} ride terakhir ≥ 3 km`} />
          <div className="rounded-lg bg-surface p-4">
            {speed ? (
              <p className="mb-3 text-[15px] leading-6">
                {Math.abs(speed.deltaKmh) < 0.5 ? "Stabil." : speed.deltaKmh > 0 ? "Iya." : "Belum."}{" "}
                <span className="text-muted-foreground">5 ride terakhir rata-rata</span>{" "}
                <span className="font-semibold tabular-nums">{fmtNum(speed.recentKmh)} km/j</span>
                <span className="text-muted-foreground">, 5 ride sebelumnya</span>{" "}
                <span className="font-semibold tabular-nums">{fmtNum(speed.previousKmh)} km/j</span>{" "}
                <span className={cn("tabular-nums", speed.deltaKmh < 0 ? "text-caution" : "text-ok")}>
                  ({speed.deltaKmh > 0 ? "+" : "−"}
                  {fmtNum(Math.abs(speed.deltaKmh))})
                </span>
                .
              </p>
            ) : (
              <p className="mb-3 text-[15px] leading-6 text-muted-foreground">
                Butuh 10 ride di atas 3 km buat bandingin tren kecepatan.
              </p>
            )}
            <SpeedChart points={speedPoints} avgKmh={avgKmh} />
            <div className="mt-2 flex justify-between text-xs tabular-nums text-muted-foreground">
              <span>{localDateLabel(speedPoints[0].startLocal)}</span>
              <span>rata-rata {fmtNum(avgKmh)} km/j</span>
              <span>{localDateLabel(speedPoints[speedPoints.length - 1].startLocal)}</span>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
