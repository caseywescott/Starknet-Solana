import { NextResponse } from "next/server";

import { fetchComposition } from "@/lib/koji-starknet";
import type { MintStatusPayload } from "@/lib/mint-status-types";
import { getKojiComposerAddress, getRendererBaseUrl, getStarknetRpcUrl } from "@/lib/starknet-env";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const contract = getKojiComposerAddress();
  const rpc = getStarknetRpcUrl();
  const id = params.id;

  let compositionId: bigint;
  try {
    compositionId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const base: MintStatusPayload = {
    compositionId: id,
    starknet: { ok: false },
    renderer: { ok: false },
    bridge: {
      note:
        "LayerZero delivery is tracked in the LayerZero scan UI when the bridge contract is live.",
    },
    solana: {
      note:
        "After the relayer runs `mint_koji`, the NFT appears on Solana devnet for the recipient wallet.",
    },
  };

  if (!rpc || !contract) {
    base.starknet = { ok: false, error: "Server RPC / composer not configured" };
    return NextResponse.json(base);
  }

  try {
    await fetchComposition(contract, compositionId);
    base.starknet = { ok: true };
  } catch (e) {
    base.starknet = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
    return NextResponse.json(base);
  }

  const rendererBase = getRendererBaseUrl();
  try {
    const res = await fetch(`${rendererBase}/api/composition/${id}`, {
      next: { revalidate: 0 },
    });
    base.renderer = res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    base.renderer = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json(base);
}
