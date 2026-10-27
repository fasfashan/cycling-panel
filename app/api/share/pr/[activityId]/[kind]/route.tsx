import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { fmtNum, metersRounded } from "@/lib/format";
import { loadFont } from "@/lib/og-fonts";
import { getRideRecord, isRecordKind, stickerFilename } from "@/lib/stats/records";
import type { RecordKind } from "@/lib/stats/records";

export const runtime = "nodejs";

// DESIGN.md tokens; Satori can't read CSS variables.
const C = {
  bg: "#121212",
  text: "#F2F2F2",
  muted: "#A3A3A8",
  brand: "#FF6B2C",
};

// stack: text straight on the photo (default). panel: same, on a dark card for bright photos.
type Variant = "stack" | "panel";
const WIDTH = 1080;
// Fits the content (badge + label + value + delta); panel adds the card inset.
const HEIGHT: Record<Variant, number> = { stack: 860, panel: 920 };

// Keeps white text readable on top of a bright photo (transparent stickers only).
const LIFT = "0 2px 12px rgba(0,0,0,0.45)";

function formatValue(kind: RecordKind, value: number): string {
  return kind === "elevation" ? metersRounded(value) : fmtNum(value, 1);
}

/**
 * Burst lines beside the badge, mirrored for the left side. Angles fan out
 * from the badge center; lengths alternate so it reads as a celebration, not a sun.
 */
function Rays({ flip }: { flip?: boolean }) {
  const rays = [
    { deg: -58, len: 34 },
    { deg: -36, len: 74 },
    { deg: -16, len: 40 },
    { deg: 0, len: 78 },
    { deg: 16, len: 40 },
    { deg: 36, len: 74 },
    { deg: 58, len: 34 },
  ];
  const cy = 130;
  const r0 = 26;
  // Mirror by coordinates; Satori's SVG transform support is unreliable.
  const x = (v: number) => (flip ? 140 - v : v);
  return (
    <svg width={140} height={260} viewBox="0 0 140 260">
      {rays.map(({ deg, len }) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={x(r0 * Math.cos(rad))}
            y1={cy + r0 * Math.sin(rad) * 2.2}
            x2={x((r0 + len) * Math.cos(rad))}
            y2={cy + (r0 + len) * Math.sin(rad) * 2.2}
            stroke={C.brand}
            strokeWidth={7}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/** Medal on an orange disc: ribbon + "PR" medallion, drawn here rather than borrowed. */
function Badge() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 240,
        height: 240,
        borderRadius: 120,
        background: C.brand,
      }}
    >
      <svg width={88} height={46} viewBox="0 0 88 46">
        <path d="M6 4h76L60 42H28z" fill="none" stroke={C.bg} strokeWidth={8} strokeLinejoin="round" />
        <path d="M30 4l14 26 14-26" fill="none" stroke={C.bg} strokeWidth={8} strokeLinejoin="round" />
      </svg>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 92,
          height: 92,
          marginTop: -6,
          borderRadius: 46,
          background: C.bg,
          color: C.brand,
          fontFamily: "Space Grotesk Bold",
          fontWeight: 700,
          fontSize: 40,
        }}
      >
        PR
      </div>
    </div>
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ activityId: string; kind: string }> }
) {
  const { activityId, kind } = await params;
  const rideId = Number(activityId);
  if (!Number.isSafeInteger(rideId) || !isRecordKind(kind)) {
    return new Response("PR tidak ditemukan", { status: 404 });
  }
  const rec = await getRideRecord(rideId, kind);
  if (!rec) return new Response("PR tidak ditemukan", { status: 404 });

  const variant: Variant = req.nextUrl.searchParams.get("v") === "panel" ? "panel" : "stack";
  const onPhoto = variant === "stack";

  // Only the record itself: category, value, and how far it beat the old one.
  const value = formatValue(kind, rec.value);
  const gain = formatValue(kind, rec.value - rec.previous.value);
  const delta = `+${gain} ${rec.unit} dari rekor sebelumnya`;

  const [label, bold, body] = await Promise.all([
    loadFont("Space Grotesk", 600, `${rec.title} ${rec.unit}`),
    loadFont("Space Grotesk", 700, `PR ${value}`),
    loadFont("Hanken Grotesk", 500, delta),
  ]);

  // Satori crashes on an undefined style value, so spread the shadow only when used.
  const shadow = onPhoto ? { textShadow: LIFT } : {};

  const content = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Rays flip />
        <Badge />
        <Rays />
      </div>
      <div style={{ display: "flex", marginTop: 56, fontFamily: "Space Grotesk", fontSize: 64, color: C.text, ...shadow }}>
        {rec.title}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 20 }}>
        {/* Not mono here: a mono comma takes a full cell and splits decimals like 21,5. */}
        <div style={{ fontFamily: "Space Grotesk Bold", fontWeight: 700, fontSize: 200, lineHeight: 1, letterSpacing: -4, color: C.text, ...shadow }}>
          {value}
        </div>
        <div style={{ fontFamily: "Space Grotesk", fontSize: 72, color: C.text, ...shadow }}>{rec.unit}</div>
      </div>
      <div style={{ display: "flex", marginTop: 24, fontFamily: "Hanken", fontSize: 40, color: onPhoto ? "rgba(242,242,242,0.85)" : C.muted, ...shadow }}>
        {delta}
      </div>
    </div>
  );

  const sticker =
    variant === "panel" ? (
      <div style={{ display: "flex", width: WIDTH, height: HEIGHT[variant], padding: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            height: "100%",
            background: "rgba(18,18,18,0.94)",
            borderRadius: 48,
            padding: 48,
          }}
        >
          {content}
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "center", width: WIDTH, height: HEIGHT[variant], padding: 64 }}>{content}</div>
    );

  // Render fully before responding: ImageResponse streams lazily, so a Satori
  // failure would otherwise surface as a cut-off response instead of a 500.
  let png: ArrayBuffer;
  try {
    png = await new ImageResponse(sticker, {
      width: WIDTH,
      height: HEIGHT[variant],
      fonts: [
        { name: "Space Grotesk", data: label, weight: 600 },
        { name: "Space Grotesk Bold", data: bold, weight: 700 },
        { name: "Hanken", data: body, weight: 500 },
      ],
    }).arrayBuffer();
  } catch (err) {
    console.error("[share/pr] render failed", err);
    return new Response("Gagal bikin stiker", { status: 500 });
  }

  const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${disposition}; filename="${stickerFilename(rideId, kind, variant === "panel")}"`,
      // A ride keeps a PR it earned even after it's beaten later, so the image is stable.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
