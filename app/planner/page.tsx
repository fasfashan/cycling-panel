import { AlertTriangle, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CoachBriefCard } from "@/components/planner/coach-brief-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLatestPlannerCoachBrief } from "@/lib/stats/coach-brief";
import { getPlannerData } from "@/lib/stats/planner";
import type { OverreachLevel } from "@/lib/stats/planner";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function OverreachBanner({
  level,
  note,
}: {
  level: OverreachLevel;
  note: string;
}) {
  if (level === "none") return null;

  const isHigh = level === "high";
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-4 text-sm",
        isHigh
          ? "border-warn/30 bg-warn/8 text-warn"
          : "border-amber-300/40 bg-amber-50 text-amber-800"
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{note}</p>
    </div>
  );
}

function WeekRow({
  label,
  distanceKm,
  rides,
  isCurrentWeek,
  safeTargetKm,
}: {
  label: string;
  distanceKm: number;
  rides: number;
  isCurrentWeek: boolean;
  safeTargetKm: number;
}) {
  const over = safeTargetKm > 0 && distanceKm > safeTargetKm;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5",
        isCurrentWeek && "bg-muted/60"
      )}
    >
      <span className="w-16 label-readout">{label}</span>
      <div className="flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              isCurrentWeek
                ? "bg-pine"
                : over
                  ? "bg-warn/50"
                  : "bg-muted-foreground/40"
            )}
            style={{
              width:
                safeTargetKm > 0
                  ? `${Math.min((distanceKm / (safeTargetKm * 1.5)) * 100, 100)}%`
                  : "0%",
            }}
          />
        </div>
      </div>
      <span
        className={cn(
          "w-16 text-right font-mono text-xs tabular-nums",
          isCurrentWeek ? "font-medium text-foreground" : "text-muted-foreground",
          over && !isCurrentWeek && "text-warn/70"
        )}
      >
        {distanceKm} km
      </span>
      <span className="w-12 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {rides}x
      </span>
    </div>
  );
}

export default async function PlannerPage() {
  const [data, latestCoachBrief] = await Promise.all([
    getPlannerData(),
    getLatestPlannerCoachBrief(),
  ]);

  if (!data.hasData) {
    return (
      <AppShell>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ShieldCheck className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-heading text-lg">No ride data yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Complete a few rides and sync - your safe ride plan shows up here.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const { recentWeeks, safeTargetKm, overreach, overreachNote } = data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Safe Ride Planner
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            10% weekly volume rule - steady progress, low injury risk.
          </p>
        </div>

        {overreach !== "none" && overreachNote ? (
          <OverreachBanner level={overreach} note={overreachNote} />
        ) : null}

        <CoachBriefCard
          initialBrief={
            latestCoachBrief
              ? {
                  id: latestCoachBrief.id,
                  model: latestCoachBrief.model,
                  brief: latestCoachBrief.brief,
                  createdAt: latestCoachBrief.createdAt.toISOString(),
                }
              : null
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Recent weeks</CardTitle>
            <CardDescription>
              Safe ceiling this week is {safeTargetKm} km
            </CardDescription>
          </CardHeader>
          <CardContent className="-mx-1 flex flex-col gap-0.5">
            {recentWeeks.map((w) => (
              <WeekRow
                key={w.label}
                label={w.label}
                distanceKm={w.distanceKm}
                rides={w.rides}
                isCurrentWeek={w.isCurrentWeek}
                safeTargetKm={safeTargetKm}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
