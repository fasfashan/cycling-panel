import { ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CoachBriefCard } from "@/components/planner/coach-brief-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCoachBrief } from "@/lib/coach/rules";
import { getPlannerData } from "@/lib/stats/planner";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
      <span className="w-16 text-xs text-muted-foreground">{label}</span>
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
          "w-16 text-right text-xs tabular-nums",
          isCurrentWeek ? "font-medium text-foreground" : "text-muted-foreground",
          over && !isCurrentWeek && "text-warn/70"
        )}
      >
        {distanceKm} km
      </span>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
        {rides}x
      </span>
    </div>
  );
}

export default async function PlannerPage() {
  const [data, brief] = await Promise.all([getPlannerData(), getCoachBrief()]);

  if (!data.hasData || !brief) {
    return (
      <AppShell>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ShieldCheck className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-heading text-lg">Belum ada data ride</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Gowes beberapa kali dan tunggu sync dari Strava. Saran ride lo muncul di sini.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const { recentWeeks, safeTargetKm } = data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Rencana ride
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Naik maksimal 10% per minggu biar progres jalan dan risiko cedera kecil.
          </p>
        </div>

        <CoachBriefCard brief={brief} />

        <Card>
          <CardHeader>
            <CardTitle>Minggu-minggu terakhir</CardTitle>
            <CardDescription>
              Batas aman minggu ini {safeTargetKm} km
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
