"use client";

import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CoachBriefPayload } from "@/lib/stats/coach-brief";
import { cn } from "@/lib/utils";

export type CoachBriefView = {
  id: number;
  model: string;
  brief: CoachBriefPayload;
  createdAt: string;
};

type Props = {
  initialBrief: CoachBriefView | null;
};

function statusLabel(status: CoachBriefPayload["status"]): string {
  if (status === "back_off") return "Back off";
  if (status === "caution") return "Caution";
  return "Steady";
}

function statusClass(status: CoachBriefPayload["status"]): string {
  if (status === "back_off") return "border-warn/30 bg-warn/8 text-warn";
  if (status === "caution") return "border-amber-300/40 bg-amber-50 text-amber-800";
  return "border-pine/20 bg-pine/8 text-pine";
}

function briefTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BriefList({
  label,
  items,
  tone = "muted",
}: {
  label: string;
  items: string[];
  tone?: "muted" | "warn";
}) {
  if (items.length === 0) return null;

  return (
    <div className="min-w-0 space-y-2 border-t border-border pt-4">
      <span className="label-readout">{label}</span>
      <ul className="grid gap-2 text-sm leading-6 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item}
            className={cn(
              "min-w-0 break-words rounded-md bg-muted/40 px-3 py-2",
              tone === "warn" ? "text-warn" : "text-muted-foreground"
            )}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CoachBriefCard({ initialBrief }: Props) {
  const [brief, setBrief] = useState(initialBrief);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/planner/brief", { method: "POST" });
      const data = (await res.json()) as {
        ok: boolean;
        brief?: {
          id: number;
          model: string;
          brief: CoachBriefPayload;
          createdAt: string;
        };
        error?: string;
      };

      if (!res.ok || !data.ok || !data.brief) {
        throw new Error(data.error ?? "Could not generate coach brief.");
      }

      setBrief({
        id: data.brief.id,
        model: data.brief.model,
        brief: data.brief.brief,
        createdAt: data.brief.createdAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate coach brief.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-pine" aria-hidden />
              <CardTitle>Coach brief</CardTitle>
            </div>
            <CardDescription>
              {brief ? `Generated ${briefTime(brief.createdAt)}` : "Ready when ride data is synced"}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("size-4", isLoading && "animate-spin")}
              aria-hidden
            />
            {brief ? "Update" : "Generate"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {brief ? (
          <div className="flex min-w-0 flex-col gap-5">
            <div className="min-w-0 space-y-3">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
                <span
                  className={cn(
                    "w-fit shrink-0 rounded-md border px-2 py-1 text-xs font-medium",
                    statusClass(brief.brief.status)
                  )}
                >
                  {statusLabel(brief.brief.status)}
                </span>
                <h2 className="min-w-0 max-w-3xl break-words font-heading text-lg font-medium leading-snug">
                  {brief.brief.headline}
                </h2>
              </div>
              <p className="max-w-3xl break-words text-sm leading-6 text-muted-foreground">
                {brief.brief.coachNote}
              </p>
            </div>

            <div className="grid min-w-0 gap-5 border-t border-border pt-4 md:grid-cols-[1fr_1.15fr]">
              <div className="min-w-0 space-y-1.5">
                <span className="label-readout">Main focus</span>
                <p className="break-words text-sm leading-6">
                  {brief.brief.primaryFocus}
                </p>
              </div>
              <div className="min-w-0 space-y-2">
                <span className="label-readout">Coach call</span>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-mono text-2xl font-medium tabular-nums text-pine">
                    {brief.brief.nextRide.distanceKm}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">km</span>
                </div>
                <p className="break-words text-sm leading-6 text-muted-foreground">
                  {brief.brief.nextRide.intensity} - {brief.brief.nextRide.note}
                </p>
                {brief.brief.nextRide.options.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {brief.brief.nextRide.options.map((option) => (
                      <li
                        key={option}
                        className="max-w-full break-words rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
                      >
                        {option}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <BriefList label="Action cues" items={brief.brief.actions} />
            <BriefList label="Data read" items={brief.brief.observations} />
            <BriefList label="Why this matters" items={brief.brief.why} />
            <BriefList label="Watchouts" items={brief.brief.watchouts} tone="warn" />

            {brief.brief.caution ? (
              <p className="rounded-md border border-warn/20 bg-warn/8 p-3 text-sm text-warn">
                {brief.brief.caution}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Generate a short briefing from the latest planner numbers.
            </p>
            {error ? <p className="text-sm text-warn">{error}</p> : null}
          </div>
        )}

        {brief && error ? <p className="mt-4 text-sm text-warn">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
