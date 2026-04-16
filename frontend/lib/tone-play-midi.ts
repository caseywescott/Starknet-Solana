import { Midi } from "@tonejs/midi";
import * as Tone from "tone";

/**
 * Play a Standard MIDI File using Tone.js (call from a click handler so
 * `Tone.start()` succeeds).
 */
export async function playMidiBuffer(data: ArrayBuffer | Uint8Array): Promise<() => void> {
  await Tone.start();
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const midi = new Midi(bytes);
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.3 },
  }).toDestination();
  synth.volume.value = -10;

  const start = Tone.now() + 0.08;

  for (const track of midi.tracks) {
    for (const note of track.notes) {
      synth.triggerAttackRelease(note.name, note.duration, start + note.time, note.velocity);
    }
  }

  return () => {
    synth.releaseAll();
    synth.dispose();
  };
}
