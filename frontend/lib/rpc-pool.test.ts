import { describe, expect, it, vi } from "vitest";

import { callWithFallback } from "./rpc-pool";

describe("callWithFallback", () => {
  it("throws when no RPC URLs", async () => {
    await expect(
      callWithFallback(undefined, undefined, async () => 1),
    ).rejects.toThrow(/No Starknet RPC URL/);
  });

  it("uses primary when it succeeds", async () => {
    const fn = vi.fn(async () => 42);
    const out = await callWithFallback(
      "https://primary.example/rpc",
      "https://fallback.example/rpc",
      fn,
    );
    expect(out).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("falls back when primary throws", async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      n += 1;
      if (n === 1) throw new Error("primary down");
      return 99;
    });
    const out = await callWithFallback(
      "https://primary.example/rpc",
      "https://fallback.example/rpc",
      fn,
    );
    expect(out).toBe(99);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
