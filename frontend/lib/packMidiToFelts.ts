/**
 * Mirrors Cairo `output::to_felt252_array` (koji_prd.md §5.2) for tests and off-chain tooling.
 */

export function packMidiToFelts(midiBytes: Uint8Array): bigint[] {
  const len = midiBytes.length;
  const result: bigint[] = [BigInt(len)];

  let i = 0;
  while (i < len) {
    let val = 0n;
    let j = 0;
    while (j < 31 && i + j < len) {
      val = val * 256n + BigInt(midiBytes[i + j]!);
      j += 1;
    }
    result.push(val);
    i += 31;
  }

  return result;
}
