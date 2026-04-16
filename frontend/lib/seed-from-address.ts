/** Derive a display-only default u256 seed hex from a Starknet account address. */
export function suggestedSeedHex(starknetAddress: string): string {
  const hex = starknetAddress.replace(/^0x/i, "").toLowerCase();
  const head = (hex + "0".repeat(64)).slice(0, 16);
  return `0x${head.padEnd(64, "0")}`;
}
