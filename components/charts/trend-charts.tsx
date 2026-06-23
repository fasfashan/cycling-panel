"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { WeeklyBucket, SpeedPoint, ElevationPoint } from "@/lib/stats/trends";

// ── Shared tooltip style ─────────────────────────────────────────────────────
const TOOLTIP_STYLE: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e3e5e8",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  color: "#1a1c1e",
  padding: "6px 10px",
};

const CURSOR_STYLE = { fill: "#f4f5f6" };

// Pine accent & muted grey (match CSS vars).
const PINE = "#0e5c4a";
const MUTED = "#9aa0a6";
const TICK_STYLE = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  fill: "#6b7177",
};

function chartHeight(className?: string) {
  return className ?? "h-48 sm:h-60";
}

// ── Weekly distance bar chart ────────────────────────────────────────────────
type WeeklyBarProps = { data: WeeklyBucket[]; className?: string };

export function WeeklyDistanceChart({ data, className }: WeeklyBarProps) {
  if (data.length === 0) return <Empty />;
  return (
    <div className={chartHeight(className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e3e5e8" strokeDasharray="3 3" />
          <XAxis dataKey="weekLabel" tick={TICK_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} unit=" km" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={CURSOR_STYLE}
            formatter={(v, _, p) => {
              const km = Number(v);
              const rides: number = p.payload?.rides ?? 0;
              return [`${km} km · ${rides} ride${rides !== 1 ? "s" : ""}`, "Week"];
            }}
          />
          <Bar dataKey="distanceKm" fill={PINE} radius={[3, 3, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Speed progression line chart ─────────────────────────────────────────────
type SpeedLineProps = { data: SpeedPoint[]; className?: string };

export function SpeedProgressionChart({ data, className }: SpeedLineProps) {
  if (data.length === 0) return <Empty />;
  return (
    <div className={chartHeight(className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e3e5e8" strokeDasharray="3 3" />
          <XAxis dataKey="dateLabel" tick={TICK_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} unit=" km/h" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ stroke: "#e3e5e8" }}
            formatter={(v, _, p) => {
              const kmh = Number(v);
              const dist: number = p.payload?.distanceKm ?? 0;
              return [`${kmh} km/h · ${dist} km`, "Avg speed"];
            }}
          />
          <Line
            type="monotone"
            dataKey="avgSpeedKmh"
            stroke={PINE}
            strokeWidth={2}
            dot={{ r: 3, fill: PINE, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: PINE, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Cumulative elevation line chart ──────────────────────────────────────────
type ElevationLineProps = { data: ElevationPoint[]; className?: string };

export function CumulativeElevationChart({ data, className }: ElevationLineProps) {
  if (data.length === 0) return <Empty />;
  return (
    <div className={chartHeight(className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e3e5e8" strokeDasharray="3 3" />
          <XAxis dataKey="dateLabel" tick={TICK_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} unit=" m" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ stroke: "#e3e5e8" }}
            formatter={(v) => [`${Number(v)} m`, "Total elevation"]}
          />
          <Line
            type="monotone"
            dataKey="cumulativeElevationM"
            stroke={MUTED}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      Not enough data yet
    </div>
  );
}
