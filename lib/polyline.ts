/** [lat, lng] pair. */
export type LatLng = [number, number];

/** Decode a Google encoded polyline (Strava's map.summary_polyline). */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/** Approximate meters between two points (fine at segment scale). */
function meters(a: LatLng, b: LatLng): number {
  const k = Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  const dy = (a[0] - b[0]) * 111_320;
  const dx = (a[1] - b[1]) * 111_320 * k;
  return Math.hypot(dx, dy);
}

/** Indices of the route points closest to `target`, nearest first. */
function nearestCandidates(points: LatLng[], target: LatLng, count: number): number[] {
  return points
    .map((p, i) => [i, meters(p, target)] as const)
    .sort((x, y) => x[1] - y[1])
    .slice(0, count)
    .map(([i]) => i);
}

/**
 * Approximate the part of a route covered by a segment. The summary polyline
 * is simplified and segment efforts index the full stream, so we snap the
 * segment's start/end coordinates to route points. Out-and-back rides pass
 * the same spot twice, so among the nearest candidates we pick the forward
 * pair whose along-route length best matches the segment distance.
 */
export function segmentSlice(points: LatLng[], start: LatLng, end: LatLng, distanceM: number): [number, number] {
  const along = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + meters(points[i - 1], points[i]));

  const starts = nearestCandidates(points, start, 8);
  const ends = nearestCandidates(points, end, 8);
  let best: [number, number] = [starts[0], Math.max(starts[0] + 1, ends[0])];
  let bestCost = Infinity;
  for (const a of starts) {
    for (const b of ends) {
      if (b <= a) continue;
      const cost =
        Math.abs(along[b] - along[a] - distanceM) + meters(points[a], start) + meters(points[b], end);
      if (cost < bestCost) {
        bestCost = cost;
        best = [a, b];
      }
    }
  }
  return best;
}

/**
 * Project lat/lng into an SVG box (equirectangular, longitude scaled by
 * cos(latitude) so shapes don't stretch), centered and aspect-preserved.
 */
export function projectToBox(points: LatLng[], width: number, height: number, pad: number) {
  const midLat = (Math.min(...points.map((p) => p[0])) + Math.max(...points.map((p) => p[0]))) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = points.map((p) => p[1] * k);
  const ys = points.map((p) => -p[0]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1e-9;
  const spanY = Math.max(...ys) - minY || 1e-9;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return points.map((_, i) => [offX + (xs[i] - minX) * scale, offY + (ys[i] - minY) * scale] as [number, number]);
}

export function toSvgPath(xy: [number, number][]): string {
  return xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}
