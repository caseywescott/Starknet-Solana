import { createHash } from "node:crypto";

import bs58 from "bs58";
import type { ParsedTransactionWithMeta } from "@solana/web3.js";
import { Connection, PublicKey } from "@solana/web3.js";

/** Anchor `sha256("global:<name>")[0..8]` discriminator. */
export function anchorDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

const MINT_KOJI_DISC = anchorDiscriminator("mint_koji");

export function tryParseMintKojiCompositionId(ixData: Buffer): bigint | null {
  if (ixData.length < 16) return null;
  if (!ixData.subarray(0, 8).equals(MINT_KOJI_DISC)) return null;
  return ixData.readBigUInt64LE(8);
}

function collectProgramIxDataB58(
  parsed: ParsedTransactionWithMeta,
): Array<{ programId: string; dataB58: string }> {
  const out: Array<{ programId: string; dataB58: string }> = [];
  const msg = parsed.transaction.message;
  for (const ix of msg.instructions) {
    if ("programId" in ix && "data" in ix && typeof ix.data === "string") {
      out.push({ programId: ix.programId.toBase58(), dataB58: ix.data });
    }
  }
  const inner = parsed.meta?.innerInstructions;
  if (inner) {
    for (const group of inner) {
      for (const ix of group.instructions) {
        if ("programId" in ix && "data" in ix && typeof ix.data === "string") {
          out.push({ programId: ix.programId.toBase58(), dataB58: ix.data });
        }
      }
    }
  }
  return out;
}

/**
 * Scan recent transactions to the Koji program for a successful `mint_koji`
 * whose first arg (composition_id, u64 LE) matches `targetCompositionId`.
 *
 * Note: on-chain `mint_koji` uses u64; Starknet `composition_id` is u256 — this
 * helper is exact only when the id fits in 64 bits (hackathon / sequential ids).
 */
export async function findMintKojiSignatureForComposition(
  rpcUrl: string,
  programIdStr: string,
  targetCompositionId: bigint,
  opts?: { maxSignatures?: number },
): Promise<{ found: false } | { found: true; signature: string }> {
  const u64Max = 18446744073709551615n;
  if (targetCompositionId > u64Max) {
    return { found: false };
  }

  const maxSignatures = opts?.maxSignatures ?? 200;
  const conn = new Connection(rpcUrl, "confirmed");
  const programPk = new PublicKey(programIdStr);
  const programB58 = programPk.toBase58();

  const sigs = await conn.getSignaturesForAddress(programPk, { limit: maxSignatures });
  for (const { signature } of sigs) {
    const parsed = await conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!parsed || parsed.meta?.err) continue;

    for (const { programId, dataB58 } of collectProgramIxDataB58(parsed)) {
      if (programId !== programB58) continue;
      let data: Buffer;
      try {
        data = Buffer.from(bs58.decode(dataB58));
      } catch {
        continue;
      }
      const cid = tryParseMintKojiCompositionId(data);
      if (cid === targetCompositionId) {
        return { found: true, signature };
      }
    }
  }
  return { found: false };
}
