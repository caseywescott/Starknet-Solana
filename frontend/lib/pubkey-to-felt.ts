import { PublicKey } from "@solana/web3.js";

/** Starknet field prime (same as starknet.js `constants.PRIME`). */
const STARKNET_PRIME = 2n ** 251n + 17n * 2n ** 192n + 1n;

/** Map Solana pubkey bytes into a Starknet felt252 (field element). */
export function pubkeyToFeltString(pubkeyBase58: string): string {
  const pk = new PublicKey(pubkeyBase58);
  const buf = pk.toBytes();
  let x = 0n;
  for (let i = 0; i < 32; i++) {
    x |= BigInt(buf[i]!) << (8n * BigInt(i));
  }
  const felt = x % STARKNET_PRIME;
  return felt.toString();
}
