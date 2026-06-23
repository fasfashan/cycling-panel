import { cn } from "@/lib/utils";

type MetricReadoutProps = {
  /** Small spaced uppercase label, e.g. "Total distance" */
  label: string;
  /** Pre-formatted value. Format/convert units at the call site. */
  value: string | number;
  /** Optional unit suffix, e.g. "km", "km/h", "m". */
  unit?: string;
  /** Optional secondary line under the value (context / sublabel). */
  hint?: string;
  /** Optional week-over-week style delta. */
  delta?: {
    value: string;
    /** up = positive/improving, down = negative, flat = unchanged */
    direction: "up" | "down" | "flat";
    /** Treat "up" as good (green) or bad (warn). Default: up is good. */
    upIsGood?: boolean;
  };
  /** Use the pine accent on the value — reserve for live / this-week / PR. */
  accent?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const valueSize = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl",
} as const;

export function MetricReadout({
  label,
  value,
  unit,
  hint,
  delta,
  accent = false,
  size = "md",
  className,
}: MetricReadoutProps) {
  const deltaGood =
    delta &&
    (delta.direction === "flat"
      ? null
      : (delta.direction === "up") === (delta.upIsGood ?? true));

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="label-readout">{label}</span>

      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono font-medium leading-none tabular-nums",
            valueSize[size],
            accent ? "text-pine" : "text-foreground"
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className="font-mono text-sm text-muted-foreground tabular-nums">
            {unit}
          </span>
        ) : null}
      </div>

      {delta ? (
        <span
          className={cn(
            "font-mono text-xs tabular-nums",
            deltaGood === null && "text-muted-foreground",
            deltaGood === true && "text-pine",
            deltaGood === false && "text-warn"
          )}
        >
          {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—"}{" "}
          {delta.value}
        </span>
      ) : null}

      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}
