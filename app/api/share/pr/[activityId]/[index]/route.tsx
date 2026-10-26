import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { fmtNum } from "@/lib/format";
import { loadFont } from "@/lib/og-fonts";
import { decodePolyline, projectToBox, segmentSlice, toSvgPath } from "@/lib/polyline";
import { effortTime, getSegmentPr } from "@/lib/stats/prs";

export const runtime = "nodejs";

// DESIGN.md tokens; Satori can't read CSS variables.
const C = {
  text: "#F2F2F2",
  muted: "#A3A3A8",
  brand: "#FF6B2C",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// stack: Strava-style text straight on the photo (default).
// panel: the same content on a dark card, for bright photos.
type Variant = "stack" | "panel";
const SIZE: Record<Variant, { width: number; height: number }> = {
  stack: { width: 1080, height: 1350 },
  panel: { width: 1080, height: 1240 },
};

// Keeps white text readable on top of a bright photo (transparent stickers only).
const LIFT = "0 2px 12px rgba(0,0,0,0.45)";

// Satori's lineClamp miscomputes height (the name overlaps the tag), so cut
// long community segment names by hand at a word boundary.
function shortName(name: string, max = 44): string {
  if (name.length <= max) return name;
  const cut = name.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : max).trimEnd()}…`;
}

function Route({
  path,
  highlight,
  width,
  height,
  base,
  baseWidth,
}: {
  path: string;
  highlight: string;
  width: number;
  height: number;
  base: string;
  baseWidth: number;
}) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={base} strokeWidth={baseWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d={highlight} fill="none" stroke={C.brand} strokeWidth={baseWidth * 2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ activityId: string; index: string }> }
) {
  const { activityId, index } = await params;
  const rideId = Number(activityId);
  const effortIndex = Number(index);
  if (!Number.isSafeInteger(rideId) || !Number.isSafeInteger(effortIndex)) {
    return new Response("PR tidak ditemukan", { status: 404 });
  }
  const found = await getSegmentPr(rideId, effortIndex);
  if (!found) return new Response("PR tidak ditemukan", { status: 404 });

  const variant: Variant = req.nextUrl.searchParams.get("v") === "panel" ? "panel" : "stack";
  const { pr, polyline } = found;

  const segmentName = shortName(pr.segmentName);
  // Names past ~24 chars wrap to a second line at this size; grow the canvas
  // instead of letting Satori shrink the blocks into each other.
  const width = SIZE[variant].width;
  const height = SIZE[variant].height + (segmentName.length > 24 ? 76 : 0);
  const time = effortTime(pr.elapsedS);
  const km = fmtNum(pr.distanceM / 1000, 2);
  const kmh = fmtNum(pr.avgKmh, 1);
  const grade = `${pr.gradePct < 0 ? "−" : ""}${fmtNum(Math.abs(pr.gradePct), 1)}%`;
  const date = `${pr.date.getUTCDate()} ${MONTHS[pr.date.getUTCMonth()]} ${pr.date.getUTCFullYear()}`;

  // Route geometry, sized per variant.
  // Must fit inside the padded content box or Satori fails to render.
  const routeBox = variant === "panel" ? { w: 888, h: 300 } : { w: 936, h: 440 };
  let path = "";
  let highlight = "";
  if (polyline) {
    const pts = decodePolyline(polyline);
    if (pts.length > 1) {
      const xy = projectToBox(pts, routeBox.w, routeBox.h, 24);
      path = toSvgPath(xy);
      if (pr.start && pr.end) {
        const [a, b] = segmentSlice(pts, pr.start, pr.end, pr.distanceM);
        highlight = toSvgPath(xy.slice(a, b + 1));
      }
    }
  }

  const labels = ["PR segmen", "Waktu", "Jarak", "Kecepatan", "Grade", "km", "km/j", "Pasa Bersepeda", date].join(" ");
  const [display, displayBold, body, mono] = await Promise.all([
    loadFont("Space Grotesk", 600, `${segmentName} ${km} ${kmh} ${grade} km km/j Pasa Bersepeda`),
    loadFont("Space Grotesk", 700, `${segmentName}…`),
    loadFont("Hanken Grotesk", 500, labels),
    loadFont("JetBrains Mono", 600, time),
  ]);

  const onPhoto = variant !== "panel";
  // Satori crashes on an undefined style value, so spread the shadow only when used.
  const shadow = onPhoto ? { textShadow: LIFT } : {};
  const label = (t: string) => (
    <div style={{ fontFamily: "Hanken", fontSize: 34, color: onPhoto ? "rgba(242,242,242,0.85)" : C.muted, ...shadow }}>{t}</div>
  );
  const stat = (l: string, v: string, unit?: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label(l)}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: "Space Grotesk", fontSize: 76, color: C.text, ...shadow }}>
        {v}
        {unit ? <span style={{ fontSize: 36, color: onPhoto ? "rgba(242,242,242,0.85)" : C.muted }}>{unit}</span> : null}
      </div>
    </div>
  );
  const prTag = (
    <div style={{ display: "flex", fontFamily: "Hanken", fontSize: 38, color: C.brand, ...shadow }}>PR segmen</div>
  );
  const name = (size: number) => (
    <div
      style={{
        // Explicit width so Satori measures the wrapped height (otherwise it overlaps the tag).
        width: "100%",
        fontFamily: "Space Grotesk Bold",
        fontSize: size,
        lineHeight: 1.08,
        color: C.text,
        ...shadow,
        display: "flex",
      }}
    >
      {segmentName}
    </div>
  );
  const footer = (
    <div style={{ display: "flex", width: "100%", justifyContent: "space-between", fontFamily: "Hanken", fontSize: 32, color: onPhoto ? "rgba(242,242,242,0.85)" : C.muted, ...shadow }}>
      <span>{date}</span>
      <span style={{ fontFamily: "Space Grotesk", color: C.text }}>Pasa Bersepeda</span>
    </div>
  );

  const content = (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {prTag}
      <div style={{ display: "flex", width: "100%", flexShrink: 0, marginTop: 12 }}>{name(68)}</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
        {label("Waktu")}
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 196, lineHeight: 1.05, color: C.brand, ...shadow, letterSpacing: -6 }}>{time}</div>
      </div>
      <div style={{ display: "flex", gap: 64, marginTop: 32 }}>
        {stat("Jarak", km, "km")}
        {stat("Kecepatan", kmh, "km/j")}
        {stat("Grade", grade)}
      </div>
      {path ? (
        <div style={{ display: "flex", marginTop: 48 }}>
          <Route
            path={path}
            highlight={highlight}
            width={routeBox.w}
            height={routeBox.h}
            base={onPhoto ? "rgba(242,242,242,0.9)" : C.muted}
            baseWidth={6}
          />
        </div>
      ) : null}
      <div style={{ display: "flex", marginTop: 40 }}>{footer}</div>
    </div>
  );
  const sticker =
    variant === "panel" ? (
      <div style={{ display: "flex", width, height, padding: 32 }}>
        <div style={{ display: "flex", width: "100%", height: "100%", background: "rgba(18,18,18,0.94)", borderRadius: 48, padding: 64 }}>
          {content}
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", width, height, padding: 72 }}>{content}</div>
    );

  // Render fully before responding: ImageResponse streams lazily, so a Satori
  // failure would otherwise surface as a cut-off response instead of a 500.
  let png: ArrayBuffer;
  try {
    png = await new ImageResponse(sticker, {
      width,
      height,
      emoji: "twemoji",
      fonts: [
        { name: "Space Grotesk", data: display, weight: 600 },
        { name: "Space Grotesk Bold", data: displayBold, weight: 700 },
        { name: "Hanken", data: body, weight: 500 },
        { name: "JetBrains Mono", data: mono, weight: 600 },
      ],
    }).arrayBuffer();
  } catch (err) {
    console.error("[share/pr] render failed", err);
    return new Response("Gagal bikin stiker", { status: 500 });
  }

  const slug = pr.segmentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "segmen";
  const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${disposition}; filename="pr-${slug}${variant === "panel" ? "-kartu" : ""}.png"`,
      // A PR's numbers never change once recorded; let the CDN keep it.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
