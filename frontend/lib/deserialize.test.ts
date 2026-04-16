import { describe, expect, it } from "vitest";
import { deserializeFeltsToMidi } from "./deserialize";
import { packMidiToFelts } from "./packMidiToFelts";

function assertRoundTrip(original: Uint8Array): void {
  const packed = packMidiToFelts(original);
  const restored = deserializeFeltsToMidi(packed);
  expect(Buffer.from(restored)).toEqual(Buffer.from(original));
}

describe("deserializeFeltsToMidi", () => {
  it("round-trips empty MIDI-sized buffer (0 bytes)", () => {
    assertRoundTrip(new Uint8Array(0));
  });

  it("round-trips short buffer", () => {
    assertRoundTrip(new Uint8Array([0x4d, 0x54, 0x68, 0x64]));
  });

  it("round-trips length not divisible by 31 (e.g. 100 bytes)", () => {
    const original = new Uint8Array(100);
    for (let i = 0; i < 100; i++) original[i] = i & 0xff;
    assertRoundTrip(original);
  });

  it("round-trips exactly 31 bytes (one payload felt)", () => {
    const original = new Uint8Array(31);
    for (let i = 0; i < 31; i++) original[i] = (i * 7 + 1) & 0xff;
    assertRoundTrip(original);
  });

  it("round-trips 32 bytes (boundary: two payload felts)", () => {
    const original = new Uint8Array(32);
    for (let i = 0; i < 32; i++) original[i] = (i * 13) & 0xff;
    assertRoundTrip(original);
  });

  it("round-trips random lengths 1..200", () => {
    for (let len = 1; len <= 200; len++) {
      const original = new Uint8Array(len);
      for (let i = 0; i < len; i++) original[i] = (i * 17 + len) & 0xff;
      assertRoundTrip(original);
    }
  });
});
