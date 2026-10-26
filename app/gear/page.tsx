import { AppShell } from "@/components/app-shell";
import { MarkDoneButton } from "@/components/gear/mark-done-button";
import { SeedTasksButton } from "@/components/gear/seed-tasks-button";
import { EmptyState, SectionTitle } from "@/components/panel";
import { fmtNum } from "@/lib/format";
import { getGearWithMaintenance, taskLabel } from "@/lib/stats/gear";
import type { MaintenanceWithStatus } from "@/lib/stats/gear";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function rawField(raw: unknown, key: string): string | undefined {
  if (raw && typeof raw === "object") {
    const v = (raw as Record<string, unknown>)[key];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

/** Overdue, within the last 20% of the interval, or fine. */
function tone(t: MaintenanceWithStatus): "rest" | "caution" | "ok" {
  if (t.overdue) return "rest";
  if (t.progress >= 0.8) return "caution";
  return "ok";
}

const TONE_TEXT = { rest: "text-rest", caution: "text-caution", ok: "text-ok" } as const;
const TONE_BAR = { rest: "bg-rest", caution: "bg-caution", ok: "bg-ok" } as const;

export default async function GaragePage() {
  const gears = await getGearWithMaintenance();

  if (gears.length === 0) {
    return (
      <AppShell>
        <EmptyState
          title="Belum ada sepeda"
          body="Tambahin sepeda di Strava, terus pilih sepeda itu waktu save ride. Datanya ikut ke-sync ke sini."
          href="https://www.strava.com/settings/gear"
          cta="Atur sepeda di Strava"
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-[28px] font-bold tracking-tight">Garasi</h1>

      {gears.map((g) => {
        const model = [rawField(g.raw, "brand_name"), rawField(g.raw, "model_name")].filter(Boolean).join(" ");
        const overdue = g.tasks.filter((t) => t.overdue).length;

        return (
          <div key={g.id}>
            <section aria-label={g.name} className="mt-5 rounded-lg bg-surface p-5">
              <p className="text-sm text-muted-foreground">
                {g.name}
                {model ? ` · ${model}` : ""}
              </p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="num-hero text-[52px] font-semibold leading-none">{fmtNum(g.totalDistanceKm, 0)}</span>
                <span className="text-lg text-muted-foreground">km</span>
              </p>
              {g.tasks.length > 0 ? (
                <p className={cn("mt-2 text-sm", overdue ? "text-rest" : "text-ok")}>
                  {overdue ? `${overdue} perawatan lewat jadwal` : "Semua perawatan masih aman"}
                </p>
              ) : null}
            </section>

            {g.tasks.length === 0 ? (
              <div className="mt-6">
                <p className="text-[15px] leading-6 text-muted-foreground">
                  Belum ada jadwal perawatan. Pasang jadwal default (lumasi rantai, cek ban, kampas rem, dan
                  lainnya), dihitung mulai dari odometer sekarang.
                </p>
                <SeedTasksButton />
              </div>
            ) : (
              <>
                <SectionTitle title="Perawatan" aside="urut dari paling mendesak" />
                <ul className="space-y-2">
                  {g.tasks.map((t) => {
                    const tn = tone(t);
                    const late = t.kmSinceService - t.intervalKm;
                    return (
                      <li key={t.id} className="rounded-lg bg-surface p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[15px] font-medium">{taskLabel(t.task)}</p>
                            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                              Tiap {fmtNum(t.intervalKm, 0)} km · terakhir di km{" "}
                              {fmtNum(t.lastDoneDistanceM / 1000, 0)}
                            </p>
                          </div>
                          <p className={cn("shrink-0 text-right text-sm font-semibold tabular-nums", TONE_TEXT[tn])}>
                            {t.overdue ? `Telat ${fmtNum(late, 0)} km` : `${fmtNum(t.kmUntilNext, 0)} km lagi`}
                          </p>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden>
                          <div
                            className={cn("h-full rounded-full", TONE_BAR[tn])}
                            style={{ width: `${Math.min(100, t.progress * 100)}%` }}
                          />
                        </div>
                        <MarkDoneButton taskId={t.id} label={taskLabel(t.task)} />
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        );
      })}
    </AppShell>
  );
}
