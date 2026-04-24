import { describe, expect, it } from "vitest";

import { anchorDiscriminator, tryParseMintKojiCompositionId } from "./find-solana-mint";

describe("find-solana-mint", () => {
  it("matches relayer Anchor discriminator for mint_koji", () => {
    const d = anchorDiscriminator("mint_koji");
    expect(d.length).toBe(8);
  });

  it("parses composition_id from mint_koji ix layout", () => {
    const disc = anchorDiscriminator("mint_koji");
    const buf = Buffer.alloc(8 + 8);
    disc.copy(buf, 0);
    buf.writeBigUInt64LE(99n, 8);
    expect(tryParseMintKojiCompositionId(buf)).toBe(99n);
  });

  it("returns null for wrong discriminator", () => {
    const buf = Buffer.alloc(16);
    buf.fill(1);
    expect(tryParseMintKojiCompositionId(buf)).toBeNull();
  });
});
