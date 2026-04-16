/**
 * Poll Starknet `BridgeMintRequested` and submit Solana `mint_koji`.
 *
 * Required env:
 * - STARKNET_RPC_PRIMARY (or STARKNET_RPC_URL)
 * - KOJI_BRIDGE_ADDRESS (hex Starknet address)
 * - SOLANA_RPC_URL, RELAYER_KEYPAIR, KOJI_PROGRAM_ID
 *
 * Optional env:
 * - RELAYER_POLL_MS (default: 8000)
 * - RELAYER_CHUNK_SIZE (default: 20)
 * - RELAYER_START_BLOCK (default: latest at startup)
 */
import { Buffer } from "node:buffer";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";
import { RpcProvider, hash } from "starknet";

import { submitMintKoji } from "./mint.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

type BridgeEvent = {
  compositionId: bigint;
  composerSolanaFelt: bigint;
  seedLo: bigint;
  seedHi: bigint;
  scale: number;
  rhythmDensity: number;
  bpm: number;
};

type ListenerState = {
  fromBlock: number;
  processed: string[];
};

const DEFAULT_STATE_FILE = ".relay-state.json";
const MAX_PROCESSED_KEYS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function feltToU256Hex(v: bigint): string {
  return `0x${v.toString(16)}`;
}

function feltToPubkey(v: bigint): PublicKey {
  if (v < 0n) throw new Error("negative felt not allowed for pubkey");
  let hex = v.toString(16);
  if (hex.length > 64) throw new Error("felt too large for Solana pubkey");
  hex = hex.padStart(64, "0");
  return new PublicKey(Buffer.from(hex, "hex"));
}

function parseBridgeMintRequested(data: string[]): BridgeEvent {
  if (data.length < 8) {
    throw new Error(`BridgeMintRequested expected >= 8 felts, got ${data.length}`);
  }
  // Cairo event payload order from `BridgeMintRequested` struct:
  // composition_id.low, composition_id.high, composer_solana, seed.low, seed.high, scale, rhythm_density, bpm
  return {
    compositionId: BigInt(data[0]),
    composerSolanaFelt: BigInt(data[2]),
    seedLo: BigInt(data[3]),
    seedHi: BigInt(data[4]),
    scale: Number(BigInt(data[5])),
    rhythmDensity: Number(BigInt(data[6])),
    bpm: Number(BigInt(data[7])),
  };
}

function loadState(path: string): ListenerState | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as ListenerState;
    if (typeof raw.fromBlock !== "number" || !Array.isArray(raw.processed)) {
      return null;
    }
    return {
      fromBlock: raw.fromBlock,
      processed: raw.processed.filter((x) => typeof x === "string").slice(-MAX_PROCESSED_KEYS),
    };
  } catch {
    return null;
  }
}

function saveState(path: string, state: ListenerState): void {
  writeFileSync(path, JSON.stringify(state, null, 2));
}

async function submitWithRetry(
  event: BridgeEvent,
  owner: PublicKey,
  maxRetries: number,
): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await submitMintKoji({
        compositionId: event.compositionId,
        seedLo: event.seedLo,
        seedHi: event.seedHi,
        scale: event.scale,
        rhythmDensity: event.rhythmDensity,
        bpm: event.bpm,
        owner,
      });
    } catch (err) {
      lastErr = err;
      if (i === maxRetries) break;
      const waitMs = Math.min(1000 * 2 ** i, 15000);
      console.warn(`[listen] mint retry ${i + 1}/${maxRetries} in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

async function main() {
  const rpc = process.env.STARKNET_RPC_PRIMARY ?? process.env.STARKNET_RPC_URL;
  const bridgeAddress = process.env.KOJI_BRIDGE_ADDRESS;
  const pollMs = Number(process.env.RELAYER_POLL_MS ?? 8000);
  const chunkSize = Number(process.env.RELAYER_CHUNK_SIZE ?? 20);
  const maxRetries = Number(process.env.RELAYER_MAX_RETRIES ?? 3);
  const statePath = process.env.RELAYER_STATE_PATH ?? DEFAULT_STATE_FILE;
  const dryRun = process.env.RELAYER_DRY_RUN === "1";
  if (!rpc || !bridgeAddress) {
    throw new Error("Need STARKNET_RPC_PRIMARY (or STARKNET_RPC_URL) and KOJI_BRIDGE_ADDRESS");
  }

  const provider = new RpcProvider({ nodeUrl: rpc });
  const eventKey = hash.getSelectorFromName("BridgeMintRequested");
  const state = loadState(statePath);
  const processed = new Set(state?.processed ?? []);
  let continuationToken: string | undefined;
  let fromBlock = state?.fromBlock
    ?? (process.env.RELAYER_START_BLOCK
      ? Number(process.env.RELAYER_START_BLOCK)
      : (await provider.getBlockNumber()));

  console.log(
    `[listen] polling BridgeMintRequested from block ${fromBlock} on ${bridgeAddress} (state: ${statePath}, dryRun: ${dryRun})`,
  );

  while (true) {
    try {
      const toBlock = await provider.getBlockNumber();
      const res = await provider.getEvents({
        address: bridgeAddress,
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        keys: [[eventKey]],
        chunk_size: chunkSize,
        continuation_token: continuationToken,
      });

      for (const ev of res.events) {
        const eventData = (ev as { data?: string[]; event?: { data?: string[] } }).data
          ?? (ev as { event?: { data?: string[] } }).event?.data;
        if (!eventData) continue;
        const parsed = parseBridgeMintRequested(eventData);
        const txHash = (ev as { transaction_hash?: string; event?: { transaction_hash?: string } }).transaction_hash
          ?? (ev as { event?: { transaction_hash?: string } }).event?.transaction_hash
          ?? "unknown_tx";
        const dedupeKey = `${txHash}:${parsed.compositionId}:${parsed.seedLo}:${parsed.seedHi}`;
        if (processed.has(dedupeKey)) continue;

        const owner = feltToPubkey(parsed.composerSolanaFelt);
        console.log(
          `[listen] minting composition=${parsed.compositionId} owner=${owner.toBase58()} seed=${feltToU256Hex(parsed.seedHi)}${feltToU256Hex(parsed.seedLo).slice(2)}`,
        );
        const sig = dryRun
          ? "DRY_RUN_NO_TX"
          : await submitWithRetry(parsed, owner, maxRetries);
        processed.add(dedupeKey);
        if (processed.size > MAX_PROCESSED_KEYS) {
          const toDrop = processed.size - MAX_PROCESSED_KEYS;
          let dropped = 0;
          for (const k of processed) {
            processed.delete(k);
            dropped += 1;
            if (dropped >= toDrop) break;
          }
        }
        if (dryRun) {
          console.log(`[listen] dry-run ok composition=${parsed.compositionId} owner=${owner.toBase58()}`);
        } else {
          console.log(`[listen] mint_koji ok composition=${parsed.compositionId} sig=${sig}`);
        }
        saveState(statePath, {
          fromBlock,
          processed: Array.from(processed),
        });
      }

      continuationToken = (res as { continuation_token?: string; continuationToken?: string }).continuation_token
        ?? (res as { continuationToken?: string }).continuationToken
        ?? undefined;
      if (!continuationToken) {
        fromBlock = toBlock + 1;
        saveState(statePath, {
          fromBlock,
          processed: Array.from(processed),
        });
      }
    } catch (err) {
      console.error("[listen] loop error:", err);
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }
}

main().catch((err) => {
  console.error("[listen] fatal:", err);
  process.exit(1);
});
