import { Midi } from "@tonejs/midi";

import { euclideanRhythm } from "./euclid";
import { SCALE_INTERVALS } from "./modes";

export type PreviewParams = {
  seed: bigint;
  scale: number;
  density: number;
  bpm: number;
};

/**
 * Client-side preview only. Contract MIDI may differ until the TS Koji parser
 * is wired (PRD §8.3); this encodes the same form parameters into a short SMF.
 */
export function buildPreviewMidi(params: PreviewParams): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(params.bpm);
  const track = midi.addTrack();
  track.name = "Koji preview";

  const intervals = SCALE_INTERVALS[params.scale] ?? SCALE_INTERVALS[0]!;
  const root = 48 + Number((params.seed >> 16n) % 12n);
  const pattern = euclideanRhythm(params.density, 16);
  const secondsPerStep = 60 / params.bpm / 4;

  for (let step = 0; step < 48; step++) {
    if (!pattern[step % 16]) continue;
    const deg = Number((params.seed >> BigInt((step * 5) % 60)) % BigInt(intervals.length));
    const semi = intervals[deg % intervals.length]!;
    const midiN = root + semi;
    const t = step * secondsPerStep;
    const vel = 0.55 + Number((params.seed >> BigInt(step)) % 40n) / 100;
    track.addNote({
      midi: midiN,
      time: t,
      duration: secondsPerStep * 0.92,
      velocity: Math.min(0.95, vel),
    });
  }

  return midi.toArray();
}
