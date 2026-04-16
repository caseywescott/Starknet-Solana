import { describe, expect, it } from "vitest";

import { calldataToU256, decodeCompositionReturn, u256ToCalldata } from "./koji-starknet";

describe("u256ToCalldata / calldataToU256", () => {
  it("round-trips zero", () => {
    const [lo, hi] = u256ToCalldata(0n);
    expect(calldataToU256(BigInt(lo), BigInt(hi))).toBe(0n);
  });

  it("round-trips large id", () => {
    const n = (1n << 200n) + 42n;
    const [lo, hi] = u256ToCalldata(n);
    expect(calldataToU256(BigInt(lo), BigInt(hi))).toBe(n);
  });
});

describe("decodeCompositionReturn", () => {
  it("decodes 10 felts in contract field order", () => {
    const seed = 0xabcdefn;
    const [sLo, sHi] = u256ToCalldata(seed);
    const [idLo, idHi] = u256ToCalldata(7n);
    const felts = [
      sLo,
      sHi,
      "3",
      "7",
      "120",
      "0x55",
      "0x66",
      "99",
      idLo,
      idHi,
    ];
    const d = decodeCompositionReturn(felts);
    expect(d.seed).toBe(seed);
    expect(d.scale).toBe(3);
    expect(d.rhythm_density).toBe(7);
    expect(d.bpm).toBe(120);
    expect(d.block_number).toBe(99n);
    expect(d.composition_id).toBe(7n);
  });
});
