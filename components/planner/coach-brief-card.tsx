import { Card, CardContent } from "@/components/ui/card";
import type { CoachBrief, CoachStatus } from "@/lib/coach/rules";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<CoachStatus, string> = {
  steady: "Aman",
  caution: "Hati-hati",
  back_off: "Rehat",
};

const STATUS_CLASS: Record<CoachStatus, string> = {
  steady: "text-pine",
  caution: "text-foreground",
  back_off: "text-warn",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-medium text-muted-foreground">{children}</h3>;
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
    <div className="min-w-0 space-y-2">
      <SectionLabel>{label}</SectionLabel>
      <ul className="space-y-1.5 text-sm leading-6">
        {items.map((item) => (
          <li
            key={item}
            className={cn(
              "break-words",
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

export function CoachBriefCard({ brief }: { brief: CoachBrief }) {
  const { status, nextRide } = brief;
  const isRest = nextRide.intensity === "rest";

  return (
    <Card>
      <CardContent className="flex min-w-0 flex-col gap-6 pt-5">
        <div className="min-w-0 space-y-2">
          <p className={cn("text-sm font-medium", STATUS_CLASS[status])}>
            {STATUS_LABEL[status]} · {brief.primaryFocus}
          </p>
          <h2 className="break-words font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {brief.headline}
          </h2>
          <p className="max-w-prose break-words text-base leading-7 text-muted-foreground">
            {brief.coachNote}
          </p>
        </div>

        <div className="min-w-0 space-y-1 border-t border-border pt-5">
          <SectionLabel>Ride berikutnya</SectionLabel>
          {isRest ? (
            <p className="font-heading text-3xl font-semibold text-warn">Libur</p>
          ) : (
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-4xl font-medium tabular-nums text-pine">
                {nextRide.distanceKm}
              </span>
              <span className="text-sm text-muted-foreground">km</span>
              <span className="text-sm text-muted-foreground">
                · {nextRide.intensity === "moderate" ? "tempo sedang" : "santai"}
              </span>
            </p>
          )}
          <p className="max-w-prose break-words text-sm leading-6 text-muted-foreground">
            {nextRide.note}
          </p>
        </div>

        <div className="grid min-w-0 gap-6 border-t border-border pt-5 md:grid-cols-2">
          <BriefList label="Yang perlu dilakuin" items={brief.actions} />
          <BriefList label="Data lo" items={brief.observations} />
          <BriefList label="Kenapa" items={brief.why} />
          <BriefList label="Awas" items={brief.watchouts} tone="warn" />
        </div>
      </CardContent>
    </Card>
  );
}
