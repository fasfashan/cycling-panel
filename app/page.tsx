import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import {
  CassetteMeter,
  EmptyState,
  RideRow,
  SectionTitle,
  WeekChart,
  WeekChartLegend,
} from "@/components/panel";
import { getToday } from "@/lib/coach/rules";
import type { CoachStatus } from "@/lib/coach/rules";
import { daysAgoLabel, dateFromDayIndex, fmtNum, localDateLabel, weekdayLabel } from "@/lib/format";
import { getGearWithMaintenance, taskLabel } from "@/lib/stats/gear";
import { JUMP_WARN, todayIndex } from "@/lib/stats/planner";
import { getRecordBook } from "@/lib/stats/records";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS: Record<CoachStatus, { label: string; text: string; dot: string }> = {
  steady: { label: "Aman", text: "text-ok", dot: "bg-ok" },
  caution: { label: "Hati-hati", text: "text-caution", dot: "bg-caution" },
  back_off: { label: "Rehat", text: "text-rest", dot: "bg-rest" },
};

export default async function TodayPage() {
  const [today, gears, book] = await Promise.all([getToday(), getGearWithMaintenance(), getRecordBook()]);

  if (!today) {
    return (
      <AppShell>
        <EmptyState
          title="Belum ada ride"
          body="Upload ride pertama lo di Strava. Begitu masuk, saran ride berikutnya muncul di sini."
        />
      </AppShell>
    );
  }

  const { brief, planner, facts } = today;
  const status = STATUS[brief.status];
  const { nextRide } = brief;
  const recentWeeks = planner.weeks.slice(-6);
  const bigJumps = recentWeeks.filter((w) => w.jump !== null && w.jump > JUMP_WARN).length;
  const usedPct = planner.safeTargetKm > 0 ? Math.min(100, (planner.currentWeekKm / planner.safeTargetKm) * 100) : 0;
  const jump = planner.lastWeekJump;
  const speed = facts.speed;
  const rpe = facts.lastRideRpe;
  const daysAgo = facts.daysSinceLastRide ?? 0;
  // Tasks come sorted by progress (most urgent first), same order as Garasi.
  const urgent = gears.flatMap((g) => g.tasks).find((t) => t.overdue);
  const todayDate = dateFromDayIndex(todayIndex());

  return (
    <AppShell>
      <p className="text-sm text-muted-foreground">
        {weekdayLabel(todayDate)}, {localDateLabel(todayDate)}
      </p>
      <p className={cn("mt-4 flex items-center gap-2 text-sm font-medium", status.text)}>
        <span className={cn("size-2 rounded-full", status.dot)} aria-hidden />
        {status.label} · {brief.primaryFocus}
      </p>
      <h1 className="mt-2 text-[30px] font-bold leading-[1.1] tracking-tight">{brief.headline}</h1>

      <section aria-labelledby="next-ride" className="mt-6 rounded-lg bg-surface p-5">
        <h2 id="next-ride" className="font-sans text-sm font-normal text-muted-foreground">
          Ride berikutnya
        </h2>
        {nextRide.intensity === "rest" ? (
          <p className="mt-2 font-heading text-[56px] font-bold leading-none text-rest">Libur</p>
        ) : (
          <>
            <p className="mt-2 flex items-baseline">
              <span className="num-hero text-[64px] font-semibold leading-none text-brand">
                {nextRide.distanceKm.replace("-", "–")}
              </span>
              <span className="ml-2 text-lg text-muted-foreground">km</span>
            </p>
            <p className="mt-3 inline-flex rounded-md bg-raised px-2.5 py-1 text-sm font-medium">
              {nextRide.intensity === "moderate" ? "Tempo sedang" : "Santai"}
            </p>
          </>
        )}
        <p className="mt-3 text-[15px] leading-6 text-muted-foreground">{nextRide.note}</p>
      </section>

      <section aria-label="Data yang dipakai buat saran" className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface p-4">
          <p className="text-xs text-muted-foreground">RPE ride terakhir</p>
          {rpe !== null ? (
            <>
              <p className="mt-1.5 flex items-baseline gap-1">
                <span className={cn("num-hero text-3xl font-semibold", rpe >= 8 ? "text-rest" : "text-foreground")}>
                  {rpe}
                </span>
                <span className="text-sm text-muted-foreground">/10</span>
              </p>
              <div className="mt-2">
                <CassetteMeter value={rpe} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {rpe >= 8 ? "Berat" : rpe >= 6 ? "Sedang" : "Ringan"}, {daysAgoLabel(daysAgo)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-2xl font-semibold text-muted-foreground">Belum diisi</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Isi Perceived Exertion di Strava waktu save ride biar saran lebih akurat.
              </p>
            </>
          )}
        </div>

        <div className="rounded-lg bg-surface p-4">
          <p className="text-xs text-muted-foreground">Minggu lalu</p>
          {jump ? (
            <>
              <p className="mt-1.5">
                <span
                  className={cn(
                    "font-heading text-3xl font-bold tabular-nums",
                    jump.jump > JUMP_WARN ? "text-caution" : "text-foreground"
                  )}
                >
                  {jump.jump >= 0 ? "+" : "−"}
                  {Math.round(Math.abs(jump.jump) * 100)}%
                </span>
              </p>
              <p className="mt-2 text-xs leading-5 tabular-nums text-muted-foreground">
                {fmtNum(jump.previousKm)} → {fmtNum(jump.lastKm)} km
                {jump.jump > JUMP_WARN ? (
                  <>
                    <br />
                    Lonjakan di atas 30%
                  </>
                ) : null}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">Belum cukup data</p>
          )}
        </div>

        <div className="col-span-2 rounded-lg bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-muted-foreground">Jatah aman minggu ini</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              sisa <span className="font-semibold text-foreground">{fmtNum(planner.remainingKm)} km</span>
            </p>
          </div>
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="num-hero text-3xl font-semibold text-brand">{fmtNum(planner.currentWeekKm)}</span>
            <span className="text-sm tabular-nums text-muted-foreground">/ {fmtNum(planner.safeTargetKm)} km</span>
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-raised"
            role="progressbar"
            aria-label="Jarak minggu ini dibanding batas aman"
            aria-valuemin={0}
            aria-valuemax={planner.safeTargetKm}
            aria-valuenow={planner.currentWeekKm}
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${usedPct}%` }} />
          </div>
        </div>

        {speed && Math.abs(speed.deltaKmh) >= 0.5 ? (
          <div className="col-span-2 flex items-center justify-between rounded-lg bg-surface px-4 py-3">
            <p className="text-sm text-muted-foreground">Kecepatan 5 ride terakhir</p>
            <p className={cn("text-sm font-semibold tabular-nums", speed.deltaKmh < 0 ? "text-caution" : "text-ok")}>
              {speed.deltaKmh > 0 ? "+" : "−"}
              {fmtNum(Math.abs(speed.deltaKmh))} km/j
            </p>
          </div>
        ) : null}
      </section>

      {brief.why.length > 0 || brief.watchouts.length > 0 ? (
        <details className="group mt-3 rounded-lg border border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Kenapa saran ini?
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="square"
              className="text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </summary>
          <ul className="space-y-2 px-4 pb-4 text-sm leading-6 text-muted-foreground">
            {brief.why.map((w) => (
              <li key={w}>{w}</li>
            ))}
            {brief.watchouts.map((w) => (
              <li key={w} className="text-caution">
                {w}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {urgent ? (
        <Link
          href="/gear"
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-rest/40 px-4 py-3"
        >
          <span>
            <span className="block text-sm font-medium">{taskLabel(urgent.task)} lewat jadwal</span>
            <span className="block text-xs tabular-nums text-muted-foreground">
              Telat {fmtNum(urgent.kmSinceService - urgent.intervalKm, 0)} km. Buka Garasi
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-rest">
            −{fmtNum(urgent.kmSinceService - urgent.intervalKm, 0)} km
          </span>
        </Link>
      ) : null}

      <SectionTitle title="Volume per minggu" aside={`${bigJumps} dari ${recentWeeks.length} minggu naik >30%`} />
      <div className="rounded-lg bg-surface px-3 pb-3 pt-4">
        <WeekChart weeks={recentWeeks} />
        <WeekChartLegend />
      </div>

      {facts.lastRide ? (
        <>
          <SectionTitle title="Ride terakhir" />
          <RideRow ride={facts.lastRide} card prCount={book.byRide.get(facts.lastRide.id)?.length ?? 0} />
        </>
      ) : null}
    </AppShell>
  );
}
