/**
 * On-chain renderer may return a tiny stub SMF while Cairo MIDI is still a placeholder.
 * For local playback testing, bundle `public/test.mid` (copy of repo-root `test.mid`).
 */
const MIN_NON_STUB_MIDI_BYTES = 48;

export function getFallbackMidiUrl(): string {
  return process.env.NEXT_PUBLIC_FALLBACK_MIDI_URL ?? "/test.mid";
}

export async function fetchMidiForPlayback(primaryUrl: string): Promise<ArrayBuffer> {
  const fallbackUrl = getFallbackMidiUrl();
  try {
    const r = await fetch(primaryUrl);
    if (r.ok) {
      const buf = await r.arrayBuffer();
      if (buf.byteLength >= MIN_NON_STUB_MIDI_BYTES) return buf;
    }
  } catch {
    /* use fallback */
  }

  const r2 = await fetch(fallbackUrl);
  if (!r2.ok) {
    throw new Error(
      `MIDI fetch failed and fallback ${fallbackUrl} returned ${r2.status}. Add public/test.mid (see repo test.mid).`,
    );
  }
  const fb = await r2.arrayBuffer();
  if (fb.byteLength === 0) {
    throw new Error(`Fallback MIDI is empty: ${fallbackUrl}`);
  }
  return fb;
}
