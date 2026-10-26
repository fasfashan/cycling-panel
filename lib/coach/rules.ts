import { asc } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import type { Activity } from "@/lib/db/schema";
import { localDayIndex } from "@/lib/format";
import { getPlannerData } from "@/lib/stats/planner";
import type { PlannerData } from "@/lib/stats/planner";

/**
 * Deterministic coach: turns planner numbers + recent rides into a brief.
 * No LLM. Every sentence comes from a rule below, so the brief is always
 * current and each call can be traced back to the data that triggered it.
 */

const RIDER_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Rides under this distance are errands and don't shape the plan. */
const MEANINGFUL_RIDE_M = 3000;
const HARD_RPE = 8;
const VERY_HARD_RPE = 9;
const EASY_RPE = 5;
/** A gap this long means rebuilding, not continuing. */
const RETURN_GAP_DAYS = 7;

export type CoachStatus = "steady" | "caution" | "back_off";
export type CoachIntensity = "easy" | "moderate" | "rest";

export type CoachBrief = {
  status: CoachStatus;
  headline: string;
  coachNote: string;
  primaryFocus: string;
  nextRide: {
    /** Range like "8-12"; empty when intensity is "rest". */
    distanceKm: string;
    intensity: CoachIntensity;
    note: string;
  };
  actions: string[];
  observations: string[];
  why: string[];
  watchouts: string[];
};

type RideFacts = {
  daysSinceLastRide: number | null;
  lastRide: Activity | null;
  lastRideRpe: number | null;
  recentRpeAvg: number | null;
  speedDeltaKmh: number | null;
};

function isRide(sportType: string): boolean {
  return /ride/i.test(sportType);
}

function todayIndex(): number {
  return localDayIndex(new Date(Date.now() + RIDER_TZ_OFFSET_MS));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function rideRange(centerKm: number, capKm: number | null): string {
  const cap = capKm !== null && capKm > 0 ? capKm : Infinity;
  const high = Math.max(4, Math.ceil(Math.min(centerKm + 2, cap)));
  const low = Math.max(3, Math.min(high - 1, Math.floor(centerKm - 2)));
  return `${low}-${high}`;
}

function rideFacts(rides: Activity[]): RideFacts {
  const today = todayIndex();
  const lastRide = rides.at(-1) ?? null;
  const daysSinceLastRide = lastRide
    ? Math.max(0, today - localDayIndex(lastRide.startLocal))
    : null;

  const rated = rides.filter((a) => a.rpe !== null).slice(-3);
  const recentRpeAvg =
    rated.length > 0
      ? round1(rated.reduce((sum, a) => sum + (a.rpe ?? 0), 0) / rated.length)
      : null;

  const meaningful = rides.filter((a) => a.distanceM >= MEANINGFUL_RIDE_M);
  const recentSpeed = median(meaningful.slice(-3).map((a) => a.avgSpeedMs * 3.6));
  const prevSpeed = median(meaningful.slice(-6, -3).map((a) => a.avgSpeedMs * 3.6));
  const speedDeltaKmh =
    meaningful.length >= 6 ? round1(recentSpeed - prevSpeed) : null;

  return {
    daysSinceLastRide,
    lastRide,
    lastRideRpe: lastRide?.rpe ?? null,
    recentRpeAvg,
    speedDeltaKmh,
  };
}

function decideStatus(planner: PlannerData, facts: RideFacts): CoachStatus {
  const freshFromRide = facts.daysSinceLastRide !== null && facts.daysSinceLastRide <= 1;
  if (planner.overreach === "high") return "back_off";
  if (freshFromRide && (facts.lastRideRpe ?? 0) >= VERY_HARD_RPE) return "back_off";
  if (planner.overreach === "caution") return "caution";
  if (freshFromRide && (facts.lastRideRpe ?? 0) >= HARD_RPE) return "caution";
  if ((facts.daysSinceLastRide ?? 0) >= RETURN_GAP_DAYS) return "caution";
  if (!planner.hasBaseline) return "caution";
  return "steady";
}

export function buildCoachBrief(planner: PlannerData, facts: RideFacts): CoachBrief {
  const status = decideStatus(planner, facts);
  const days = facts.daysSinceLastRide ?? 0;
  const returning = days >= RETURN_GAP_DAYS;
  const budgetLeft = planner.remainingKm > 0;
  const lastRpe = facts.lastRideRpe;
  const hardLastRide = days <= 1 && (lastRpe ?? 0) >= HARD_RPE;

  // ── Next ride ────────────────────────────────────────────────────────
  let nextRide: CoachBrief["nextRide"];
  if (status === "back_off" && days <= 1) {
    nextRide = {
      distanceKm: "",
      intensity: "rest",
      note: "Libur dulu hari ini. Kalau kaki gatel, jalan kaki santai aja.",
    };
  } else if (!budgetLeft) {
    nextRide = {
      distanceKm: "3-6",
      intensity: "easy",
      note: "Jatah aman minggu ini udah habis. Kalau mau gowes, putaran pendek buat ngelemesin kaki.",
    };
  } else if (returning) {
    nextRide = {
      distanceKm: rideRange(planner.suggestedNextRideKm * 0.7, planner.remainingKm),
      intensity: "easy",
      note: `Udah ${days} hari nggak gowes. Mulai lebih pendek dari biasanya.`,
    };
  } else {
    const canPush =
      status === "steady" && days >= 2 && lastRpe !== null && lastRpe <= EASY_RPE;
    nextRide = {
      distanceKm: rideRange(planner.suggestedNextRideKm, planner.remainingKm),
      intensity: canPush ? "moderate" : "easy",
      note: canPush
        ? "Badan udah seger. Boleh sedikit lebih cepat di bagian datar."
        : "Tempo ngobrol: masih bisa ngomong satu kalimat tanpa ngos-ngosan.",
    };
  }

  // ── Headline + note ──────────────────────────────────────────────────
  let headline: string;
  let coachNote: string;
  let primaryFocus: string;
  if (status === "back_off") {
    headline = "Badan butuh jeda dulu";
    coachNote = hardLastRide
      ? `Ride terakhir lo nilai ${lastRpe}/10. Kasih waktu pulih sebelum nambah jarak lagi.`
      : `Minggu ini udah ${planner.currentWeekKm} km, jauh di atas batas aman ${planner.safeTargetKm} km. Rehat sekarang biar minggu depan tetap bisa jalan.`;
    primaryFocus = "Pemulihan";
  } else if (hardLastRide) {
    headline = "Ride kemarin berat, hari ini santai";
    coachNote = `Lo nilai ride terakhir ${lastRpe}/10. Ride berikutnya cukup santai biar badan sempat adaptasi.`;
    primaryFocus = "Pemulihan aktif";
  } else if (planner.overreach === "caution") {
    headline = "Tahan dulu volumenya minggu ini";
    coachNote = "Volume lo naik cepat. Tetap gowes, tapi jaraknya jangan ditambah dulu.";
    primaryFocus = "Stabilin volume";
  } else if (returning) {
    headline = `Balik pelan-pelan setelah ${days} hari`;
    coachNote = "Setelah jeda, mulai lebih pendek dari biasanya. Ritme dulu, jarak belakangan.";
    primaryFocus = "Bangun ritme lagi";
  } else if (!planner.hasBaseline) {
    headline = "Kumpulin data seminggu dulu";
    coachNote = "Belum ada satu minggu penuh buat jadi patokan. Gowes santai dulu, sarannya makin akurat minggu depan.";
    primaryFocus = "Konsistensi";
  } else if (!budgetLeft) {
    headline = "Target minggu ini udah kelar";
    coachNote = `Lo udah gowes ${planner.currentWeekKm} km dari batas aman ${planner.safeTargetKm} km. Sisa minggu ini buat pulih.`;
    primaryFocus = "Pemulihan";
  } else {
    headline = `Masih ada jatah ${round1(planner.remainingKm)} km minggu ini`;
    coachNote = "Ritme lo udah pas. Pakai sisa jatah buat satu atau dua ride santai.";
    primaryFocus = "Konsistensi";
  }

  // ── Observations (facts only) ────────────────────────────────────────
  const observations: string[] = [];
  if (planner.safeTargetKm > 0) {
    observations.push(
      `Minggu ini ${planner.currentWeekKm} km dari batas aman ${planner.safeTargetKm} km.`
    );
  }
  if (facts.daysSinceLastRide !== null) {
    observations.push(
      days === 0
        ? "Ride terakhir hari ini."
        : days === 1
          ? "Ride terakhir kemarin."
          : `${days} hari sejak ride terakhir.`
    );
  }
  if (lastRpe !== null) {
    observations.push(`RPE ride terakhir ${lastRpe}/10.`);
  }
  if (facts.speedDeltaKmh !== null && Math.abs(facts.speedDeltaKmh) >= 0.5) {
    observations.push(
      facts.speedDeltaKmh > 0
        ? `Kecepatan rata-rata naik ${facts.speedDeltaKmh} km/j dibanding 3 ride sebelumnya.`
        : `Kecepatan rata-rata turun ${Math.abs(facts.speedDeltaKmh)} km/j dibanding 3 ride sebelumnya.`
    );
  }

  // ── Why (the rules that fired) ───────────────────────────────────────
  const why: string[] = [];
  if (planner.hasBaseline) {
    why.push(
      `Batas aman = minggu lalu ${planner.baselineKm} km + 10%. Naik pelan menurunkan risiko cedera.`
    );
  }
  if (hardLastRide) {
    why.push("Setelah ride berat (RPE 8+), satu ride santai bantu badan pulih.");
  }
  if (returning) {
    why.push("Setelah seminggu libur, kebugaran turun sedikit. Mulai pendek lebih aman.");
  }

  // ── Actions + watchouts ──────────────────────────────────────────────
  const actions: string[] = [];
  if (nextRide.intensity === "rest") {
    actions.push("Tidur cukup dan minum yang banyak.");
  } else {
    actions.push(`Gowes ${nextRide.distanceKm} km, ${nextRide.intensity === "moderate" ? "tempo sedang" : "tempo santai"}.`);
  }
  if (facts.lastRide && lastRpe === null) {
    actions.push("Isi Perceived Exertion di Strava waktu save ride, biar saran lebih akurat.");
  }

  const watchouts: string[] = [];
  if (planner.overreachNote) watchouts.push(planner.overreachNote);

  return {
    status,
    headline,
    coachNote,
    primaryFocus,
    nextRide,
    actions,
    observations,
    why,
    watchouts,
  };
}

/** Load planner + rides from the DB and build today's brief. */
export async function getCoachBrief(): Promise<CoachBrief | null> {
  const db = getDb();
  const [planner, rows] = await Promise.all([
    getPlannerData(),
    db.select().from(activities).orderBy(asc(activities.startDate)),
  ]);
  if (!planner.hasData) return null;

  const rides = (rows as Activity[]).filter((a) => isRide(a.sportType));
  return buildCoachBrief(planner, rideFacts(rides));
}
