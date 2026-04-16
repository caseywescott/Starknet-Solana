/**
 * Inverse of Cairo `output::to_felt252_array` (koji_prd.md §5.2, §7.5).
 * Element [0] = total byte count; subsequent felts each expand to 31 big-endian bytes.
 */

export function deserializeFeltsToMidi(felts: bigint[]): Uint8Array {
  if (felts.length === 0) {
    throw new Error("Empty felt array");
  }

  const totalBytes = Number(felts[0]);
  if (!Number.isFinite(totalBytes) || totalBytes < 0) {
    throw new Error("Invalid total byte count");
  }

  const result = new Uint8Array(totalBytes);
  let byteIndex = 0;

  for (let i = 1; i < felts.length; i++) {
    const remaining = totalBytes - byteIndex;
    if (remaining <= 0) break;

    const k = Math.min(31, remaining);
    const val = felts[i]!;

    for (let t = 0; t < k; t++) {
      const shift = BigInt(k - 1 - t) * 8n;
      result[byteIndex++] = Number((val >> shift) & 0xffn);
    }
  }

  return result;
}

/**
 * Debug / interop: expand one payload felt as if it carried a full 31-byte chunk
 * (only correct when the chunk was exactly 31 bytes on the Cairo side).
 */
export function feltTo31Bytes(felt: bigint): number[] {
  const out: number[] = [];
  for (let t = 0; t < 31; t++) {
    const shift = BigInt(30 - t) * 8n;
    out.push(Number((felt >> shift) & 0xffn));
  }
  return out;
}

export function decodeScale(scale: number): string {
  const SCALES = [
    "Major",
    "Minor",
    "Dorian",
    "Phrygian",
    "Lydian",
    "Mixolydian",
    "Locrian",
  ];
  return SCALES[scale] ?? `Scale(${scale})`;
}
