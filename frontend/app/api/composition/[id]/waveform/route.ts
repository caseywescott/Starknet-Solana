import { NextResponse } from "next/server";

/**
 * PNG waveform (PRD §7.4) — placeholder until `midi-viz` + `canvas` are wired.
 * Returns a minimal valid 1×1 PNG so marketplaces accept the URL.
 */
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export async function GET() {
  return new NextResponse(ONE_PIXEL_PNG, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
