import { PNG } from "pngjs";

function clampByte(n: number): number {
  if (n < 0) return 0;
  if (n > 255) return 255;
  return n;
}

function hashColor(seed: number): [number, number, number] {
  const r = clampByte(80 + ((seed * 53) % 140));
  const g = clampByte(120 + ((seed * 29) % 110));
  const b = clampByte(160 + ((seed * 17) % 90));
  return [r, g, b];
}

function setPixel(
  png: PNG,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

/**
 * Lightweight waveform-style PNG from raw MIDI bytes.
 * This is intentionally heuristic: it avoids full MIDI parsing while still
 * producing deterministic, composition-specific visual output.
 */
export function renderMidiWaveformPng(
  midiBytes: Uint8Array,
  width = 1200,
  height = 630,
): Buffer {
  const png = new PNG({ width, height });
  const bins = 96;
  const values = new Array<number>(bins).fill(0);
  const counts = new Array<number>(bins).fill(0);

  if (midiBytes.length > 0) {
    for (let i = 0; i < midiBytes.length; i += 1) {
      const bin = Math.floor((i * bins) / midiBytes.length);
      values[bin] += midiBytes[i] ?? 0;
      counts[bin] += 1;
    }
  }

  for (let i = 0; i < bins; i += 1) {
    if (counts[i] > 0) values[i] /= counts[i];
  }

  // Background gradient-ish fill.
  for (let y = 0; y < height; y += 1) {
    const t = y / Math.max(1, height - 1);
    const r = Math.round(8 + t * 18);
    const g = Math.round(10 + t * 22);
    const b = Math.round(18 + t * 30);
    for (let x = 0; x < width; x += 1) {
      setPixel(png, x, y, r, g, b, 255);
    }
  }

  // Deterministic accent from MIDI payload.
  const midiHash = midiBytes.reduce((acc, n, i) => (acc + n * (i + 1)) % 9973, 0);
  const [barR, barG, barB] = hashColor(midiHash);

  const leftPad = 40;
  const rightPad = 40;
  const topPad = 60;
  const bottomPad = 50;
  const graphWidth = Math.max(1, width - leftPad - rightPad);
  const graphHeight = Math.max(1, height - topPad - bottomPad);
  const baseline = topPad + graphHeight;

  // Draw faint baseline.
  for (let x = leftPad; x < leftPad + graphWidth; x += 1) {
    setPixel(png, x, baseline - 1, 55, 70, 90);
  }

  for (let i = 0; i < bins; i += 1) {
    const x0 = leftPad + Math.floor((i * graphWidth) / bins);
    const x1 = leftPad + Math.floor(((i + 1) * graphWidth) / bins);
    const barW = Math.max(1, x1 - x0 - 1);
    const amp = values[i] / 255; // 0..1
    const h = Math.max(2, Math.floor(amp * graphHeight));

    for (let x = x0; x < x0 + barW; x += 1) {
      for (let y = baseline - 1; y > baseline - h; y -= 1) {
        const shade = (baseline - y) / Math.max(1, h);
        const r = clampByte(Math.round(barR * (0.5 + shade * 0.7)));
        const g = clampByte(Math.round(barG * (0.5 + shade * 0.7)));
        const b = clampByte(Math.round(barB * (0.5 + shade * 0.7)));
        setPixel(png, x, y, r, g, b, 255);
      }
    }
  }

  return PNG.sync.write(png);
}
