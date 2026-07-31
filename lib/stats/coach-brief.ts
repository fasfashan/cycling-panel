import { createHash } from "crypto";

import { asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { activities, coachBriefs } from "@/lib/db/schema";
import type { Activity, CoachBrief } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { localDayIndex } from "@/lib/format";
import { getPlannerData } from "@/lib/stats/planner";

const PROMPT_VERSION = "planner-brief-v2";
const RIDER_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

export type CoachBriefStatus = "steady" | "caution" | "back_off";
export type CoachBriefPayload = {
  status: CoachBriefStatus;
  headline: string;
  coachNote: string;
  primaryFocus: string;
  weeklyFocus?: string;
  nextRide: {
    distanceKm: string;
    intensity: "easy" | "moderate" | "rest";
    note: string;
    options: string[];
  };
  actions: string[];
  observations: string[];
  watchouts: string[];
  why: string[];
  caution: string | null;
};

export type PlannerCoachBrief = {
  id: number;
  contextHash: string;
  model: string;
  promptVersion: string;
  brief: CoachBriefPayload;
  createdAt: Date;
};

type RidePoint = {
  date: string;
  distanceKm: number;
  movingTimeMin: number;
  avgSpeedKmh: number;
  elevationM: number;
};

function isRide(sportType: string): boolean {
  return /ride/i.test(sportType);
}

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function toDateLabel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayIndex(): number {
  return localDayIndex(new Date(Date.now() + RIDER_TZ_OFFSET_MS));
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function briefFromRow(row: CoachBrief): PlannerCoachBrief {
  return {
    id: row.id,
    contextHash: row.contextHash,
    model: row.model,
    promptVersion: row.promptVersion,
    brief: validateBrief(row.briefJson),
    createdAt: row.createdAt,
  };
}

function contextHash(context: unknown): string {
  return createHash("sha256").update(JSON.stringify(context)).digest("hex");
}

function extractText(data: unknown): string {
  const candidate = (data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  }).candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned no text.");
  }

  return text;
}

function parseJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLength);
}

function cleanWhy(value: unknown): string[] {
  if (!Array.isArray(value)) return ["The brief is based on your recent riding volume."];
  const items = value
    .map((item) => cleanText(item, "", 180))
    .filter(Boolean)
    .slice(0, 3);
  return items.length > 0
    ? items
    : ["The brief is based on your recent riding volume."];
}

function cleanList(
  value: unknown,
  fallback: string[],
  maxItems: number,
  maxLength = 150
): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => cleanText(item, "", maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
  return items.length > 0 ? items : fallback;
}

function cleanDistanceKm(value: unknown, fallback: string): string {
  return cleanText(value, fallback, 24)
    .replace(/\s*(?:km|kilometers?)\.?$/i, "")
    .trim();
}

function validateBrief(value: unknown): CoachBriefPayload {
  const raw = value as Partial<CoachBriefPayload>;
  const status: CoachBriefStatus =
    raw.status === "steady" || raw.status === "caution" || raw.status === "back_off"
      ? raw.status
      : "caution";

  const rawNextRide = (raw.nextRide ?? {}) as Partial<CoachBriefPayload["nextRide"]>;
  const intensity =
    rawNextRide.intensity === "easy" ||
    rawNextRide.intensity === "moderate" ||
    rawNextRide.intensity === "rest"
      ? rawNextRide.intensity
      : "easy";

  return {
    status,
    headline: cleanText(raw.headline, "Keep the week controlled", 90),
    coachNote: cleanText(
      raw.coachNote,
      "Keep this block steady and controlled. Build consistency first, then add distance.",
      320
    ),
    primaryFocus: cleanText(
      raw.primaryFocus ?? raw.weeklyFocus,
      "Easy endurance",
      90
    ),
    weeklyFocus: cleanText(raw.weeklyFocus, "", 90) || undefined,
    nextRide: {
      distanceKm: cleanDistanceKm(rawNextRide.distanceKm, "3-6"),
      intensity,
      note: cleanText(
        rawNextRide.note,
        "Keep it conversational and avoid chasing speed.",
        160
      ),
      options: cleanList(rawNextRide.options, [], 3, 120),
    },
    actions: cleanList(
      raw.actions,
      ["Keep the next ride easy.", "Stop while the legs still feel fresh."],
      4,
      140
    ),
    observations: cleanList(
      raw.observations,
      ["This brief is based on recent weekly volume and ride history."],
      4,
      150
    ),
    watchouts: cleanList(raw.watchouts, [], 3, 150),
    why: cleanWhy(raw.why),
    caution:
      raw.caution === null
        ? null
        : cleanText(raw.caution, "", 160) || null,
  };
}

function deterministicRideRange(suggestedKm: number, remainingKm: number): string {
  if (remainingKm <= 0) return "3-6";
  const low = Math.max(3, Math.floor(Math.min(suggestedKm, remainingKm) - 2));
  const high = Math.max(low, Math.ceil(Math.min(suggestedKm + 2, remainingKm)));
  return `${low}-${high}`;
}

async function buildPlannerCoachContext() {
  const db = getDb();
  const [planner, rows] = await Promise.all([
    getPlannerData(),
    db.select().from(activities).orderBy(asc(activities.startDate)),
  ]);

  const rides = (rows as Activity[]).filter((a) => isRide(a.sportType));
  const meaningfulRides = rides.filter((a) => a.distanceM >= 3000);
  const recentMeaningful = meaningfulRides.slice(-5);
  const lastRide = rides.at(-1);
  const today = todayIndex();
  const rideDays = rides.map((a) => localDayIndex(a.startLocal));
  const uniqueRideDays = [...new Set(rideDays)];
  const daysSinceLastRide = lastRide
    ? Math.max(0, today - localDayIndex(lastRide.startLocal))
    : null;

  const recentRidePoints: RidePoint[] = recentMeaningful.map((a) => ({
    date: toDateLabel(a.startLocal),
    distanceKm: round(a.distanceM / 1000),
    movingTimeMin: Math.round(a.movingTimeS / 60),
    avgSpeedKmh: round(a.avgSpeedMs * 3.6),
    elevationM: Math.round(a.elevationGainM),
  }));

  const lastThreeSpeed = median(
    meaningfulRides.slice(-3).map((a) => a.avgSpeedMs * 3.6)
  );
  const prevThreeSpeed = median(
    meaningfulRides.slice(-6, -3).map((a) => a.avgSpeedMs * 3.6)
  );

  const totalDistanceKm = rides.reduce((sum, a) => sum + a.distanceM / 1000, 0);
  const totalElevationM = rides.reduce((sum, a) => sum + a.elevationGainM, 0);
  const longestRideKm =
    rides.reduce((best, a) => Math.max(best, a.distanceM / 1000), 0) || 0;

  const context = {
    rider: {
      phase: "beginner base-building",
      bike: "Element Montreal URB hybrid",
      locationContext: "Bogor/Depok, Indonesia",
      availableMetrics: ["distance", "moving time", "elapsed time", "speed", "elevation"],
      unavailableMetrics: ["heart rate", "power", "cadence"],
    },
    planner: {
      hasData: planner.hasData,
      hasBaseline: planner.hasBaseline,
      baselineKm: planner.baselineKm,
      safeTargetKm: planner.safeTargetKm,
      currentWeekKm: planner.currentWeekKm,
      remainingKm: planner.remainingKm,
      suggestedNextRideKm: planner.suggestedNextRideKm,
      suggestedNextRideRangeKm: deterministicRideRange(
        planner.suggestedNextRideKm,
        planner.remainingKm
      ),
      overreach: planner.overreach,
      overreachNote: planner.overreachNote,
      recentWeeks: planner.recentWeeks,
    },
    recentPerformance: {
      totalRides: rides.length,
      totalDistanceKm: round(totalDistanceKm),
      totalElevationM: Math.round(totalElevationM),
      longestRideKm: round(longestRideKm),
      ridingDays: uniqueRideDays.length,
      daysSinceLastRide,
      recentMeaningfulRides: recentRidePoints,
      speedTrendKmh: {
        recentMedian: round(lastThreeSpeed),
        previousMedian: round(prevThreeSpeed),
        delta: round(lastThreeSpeed - prevThreeSpeed),
      },
    },
    guardrails: {
      adviceStyle: "brief, encouraging, conservative",
      doNotMention: ["medical diagnosis", "heart-rate zones", "power zones", "cadence targets"],
      nextRideDistanceMustUse: planner.remainingKm <= 0
        ? "3-6 km recovery spin or rest"
        : `${deterministicRideRange(
            planner.suggestedNextRideKm,
            planner.remainingKm
          )} km`,
    },
  };

  return { context, hash: contextHash({ promptVersion: PROMPT_VERSION, context }) };
}

export async function getLatestPlannerCoachBrief(): Promise<PlannerCoachBrief | null> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(coachBriefs)
      .where(eq(coachBriefs.kind, "planner"))
      .orderBy(desc(coachBriefs.createdAt))
      .limit(1);
    return rows[0] ? briefFromRow(rows[0] as CoachBrief) : null;
  } catch (err) {
    console.warn("Could not load coach brief cache.", err);
    return null;
  }
}

export async function generatePlannerCoachBrief(): Promise<PlannerCoachBrief> {
  const { context, hash } = await buildPlannerCoachContext();
  const db = getDb();
  const model = env.geminiModel;

  const cached = await db
    .select()
    .from(coachBriefs)
    .where(eq(coachBriefs.contextHash, hash))
    .orderBy(desc(coachBriefs.createdAt))
    .limit(1);

  if (cached[0]) return briefFromRow(cached[0] as CoachBrief);

  const brief = await requestGeminiBrief(context, model);
  const inserted = await db
    .insert(coachBriefs)
    .values({
      kind: "planner",
      contextHash: hash,
      model,
      promptVersion: PROMPT_VERSION,
      briefJson: brief,
    })
    .returning();

  return briefFromRow(inserted[0] as CoachBrief);
}

async function requestGeminiBrief(
  context: unknown,
  model: string
): Promise<CoachBriefPayload> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are a cautious beginner cycling coach for a single rider. " +
              "Use only the supplied GPS-derived cycling summary. Do not assume " +
              "heart rate, power, cadence, route details, or medical facts. Keep " +
              "advice encouraging, conservative, and practical. Prioritize consistency, " +
              "recovery, and safe weekly volume before speed. Return JSON only.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Create a concise planner coach brief from this context. " +
                "Sound like a real cycling coach: specific, calm, direct, and practical. " +
                "Avoid generic cheerleading. Mention uncertainty when the data is thin. " +
                "Make the plan conservative because the rider is a beginner and has no HR, " +
                "power, or cadence data. Use the guardrail distance exactly for nextRide.distanceKm. " +
                "Keep every list item short enough for a mobile dashboard. " +
                "Return exactly this JSON shape: " +
                "{\"status\":\"steady|caution|back_off\",\"headline\":\"string\"," +
                "\"coachNote\":\"2-3 sentence coach note\",\"primaryFocus\":\"string\"," +
                "\"nextRide\":{\"distanceKm\":\"string\",\"intensity\":\"easy|moderate|rest\"," +
                "\"note\":\"string\",\"options\":[\"string\"]}," +
                "\"actions\":[\"string\"],\"observations\":[\"string\"]," +
                "\"watchouts\":[\"string\"],\"why\":[\"string\"]," +
                "\"caution\":\"string|null\"}.\n\n" +
                JSON.stringify(context),
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini brief failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return validateBrief(parseJson(extractText(data)));
}
