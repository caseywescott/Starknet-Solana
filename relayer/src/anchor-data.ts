/**
 * Instruction data layout compatible with Anchor 0.31 `#[program]` encoding
 * (8-byte discriminator + Borsh args).
 */
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export function anchorDiscriminator(name: string): Buffer {
  const hash = createHash("sha256").update(`global:${name}`).digest();
  return hash.subarray(0, 8);
}

export const IX_INITIALIZE = anchorDiscriminator("initialize");
export const IX_MINT_KOJI = anchorDiscriminator("mint_koji");

export function borshString(s: string): Buffer {
  const utf8 = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(utf8.length, 0);
  return Buffer.concat([len, utf8]);
}

export function encodeInitializeIx(rendererBase: string): Buffer {
  return Buffer.concat([IX_INITIALIZE, borshString(rendererBase)]);
}

function writeU128LE(buf: Buffer, offset: number, value: bigint): void {
  let v = value;
  for (let i = 0; i < 16; i++) {
    buf[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

export function encodeMintKojiIx(args: {
  compositionId: bigint;
  seedLo: bigint;
  seedHi: bigint;
  scale: number;
  rhythmDensity: number;
  bpm: number;
}): Buffer {
  const body = Buffer.alloc(8 + 16 + 16 + 1 + 1 + 2);
  let o = 0;
  body.writeBigUInt64LE(args.compositionId, o);
  o += 8;
  writeU128LE(body, o, args.seedLo);
  o += 16;
  writeU128LE(body, o, args.seedHi);
  o += 16;
  body[o++] = args.scale & 0xff;
  body[o++] = args.rhythmDensity & 0xff;
  body.writeUInt16LE(args.bpm & 0xffff, o);
  return Buffer.concat([IX_MINT_KOJI, body]);
}
