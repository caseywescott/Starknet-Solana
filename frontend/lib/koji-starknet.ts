import { decodeScale, deserializeFeltsToMidi } from "./deserialize";
import { callWithFallback } from "./rpc-pool";
import { getStarknetRpcFallback, getStarknetRpcUrl } from "./starknet-env";

/** u256 as two 128-bit limbs (low, high) — Starknet calldata / return layout. */
export function u256ToCalldata(n: bigint): [string, string] {
  const mask = (1n << 128n) - 1n;
  const low = n & mask;
  const high = n >> 128n;
  return [low.toString(), high.toString()];
}

export function calldataToU256(low: bigint, high: bigint): bigint {
  return (high << 128n) | low;
}

export type CompositionFromChain = {
  seed: bigint;
  scale: number;
  rhythm_density: number;
  bpm: number;
  composer_starknet: string;
  composer_solana: bigint;
  block_number: bigint;
  composition_id: bigint;
};

/** Decode `get_composition` return (Cairo `CompositionData` Serde order). */
export function decodeCompositionReturn(felts: string[]): CompositionFromChain {
  if (felts.length < 10) {
    throw new Error(`get_composition: expected 10 felts, got ${felts.length}`);
  }
  const low = BigInt(felts[0]!);
  const high = BigInt(felts[1]!);
  const seed = calldataToU256(low, high);
  const scale = Number(BigInt(felts[2]!));
  const rhythm_density = Number(BigInt(felts[3]!));
  const bpm = Number(BigInt(felts[4]!));
  const composer_starknet = BigInt(felts[5]!).toString(16);
  const composer_solana = BigInt(felts[6]!);
  const block_number = BigInt(felts[7]!);
  const idLow = BigInt(felts[8]!);
  const idHigh = BigInt(felts[9]!);
  const composition_id = calldataToU256(idLow, idHigh);
  return {
    seed,
    scale,
    rhythm_density,
    bpm,
    composer_starknet: `0x${composer_starknet}`,
    composer_solana,
    block_number,
    composition_id,
  };
}

export async function rpcCallView(
  contractAddress: string,
  entrypoint: string,
  calldata: string[],
): Promise<string[]> {
  return callWithFallback(getStarknetRpcUrl(), getStarknetRpcFallback(), async (provider) => {
    const res = await provider.callContract({
      contractAddress,
      entrypoint,
      calldata,
    });
    return res as string[];
  });
}

export async function fetchCompositionMidiBytes(
  contractAddress: string,
  compositionId: bigint,
): Promise<Uint8Array> {
  const calldata = u256ToCalldata(compositionId);
  const felts = await rpcCallView(contractAddress, "get_composition_midi", [
    calldata[0],
    calldata[1],
  ]);
  const asBig = felts.map((f) => BigInt(f));
  return deserializeFeltsToMidi(asBig);
}

export async function fetchComposition(
  contractAddress: string,
  compositionId: bigint,
): Promise<CompositionFromChain> {
  const calldata = u256ToCalldata(compositionId);
  const felts = await rpcCallView(contractAddress, "get_composition", [calldata[0], calldata[1]]);
  return decodeCompositionReturn(felts);
}

/** `composition_count` returns u256 (low, high felts). */
export async function fetchCompositionCount(contractAddress: string): Promise<bigint> {
  const felts = await rpcCallView(contractAddress, "composition_count", []);
  if (felts.length >= 2) {
    return calldataToU256(BigInt(felts[0]!), BigInt(felts[1]!));
  }
  return BigInt(felts[0] ?? "0");
}

export { decodeScale };
