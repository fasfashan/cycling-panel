/**
 * Fonts for next/og (Satori needs raw TTF/OTF data, not the next/font CSS).
 * Fetches a Google Fonts subset containing only the glyphs in `text`.
 */

type Weight = 400 | 500 | 600 | 700;

const cache = new Map<string, Promise<ArrayBuffer>>();

async function fetchFont(family: string, weight: Weight, text: string): Promise<ArrayBuffer> {
  const url =
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}` +
    `&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!src) throw new Error(`Font not found: ${family} ${weight}`);
  const res = await fetch(src[1]);
  if (!res.ok) throw new Error(`Font download failed: ${family} ${weight}`);
  return res.arrayBuffer();
}

export function loadFont(family: string, weight: Weight, text: string) {
  // Dedupe glyphs so the cache key stays small and stable.
  const glyphs = [...new Set(text)].sort().join("");
  const key = `${family}|${weight}|${glyphs}`;
  if (!cache.has(key)) {
    const p = fetchFont(family, weight, glyphs);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key)!;
}
