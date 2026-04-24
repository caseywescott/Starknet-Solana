import { NextResponse } from "next/server";

import { findMintKojiSignatureForComposition } from "@/lib/find-solana-mint";
import { fetchComposition } from "@/lib/koji-starknet";
import type { MintStatusPayload } from "@/lib/mint-status-types";
import { getKojiProgramId, getSolanaRpcUrl } from "@/lib/solana-env";
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
    renderer: { ok: false, metadataOk: false, midiOk: false, waveformOk: false },
    bridge: {
      ok: false,
      note:
        "LayerZero delivery is tracked in the LayerZero scan UI when the bridge contract is live.",
    },
    solana: {
      ok: false,
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
    const [metaRes, midiRes, waveRes] = await Promise.all([
      fetch(`${rendererBase}/api/composition/${id}`, { next: { revalidate: 0 } }),
      fetch(`${rendererBase}/api/composition/${id}/midi`, { next: { revalidate: 0 } }),
      fetch(`${rendererBase}/api/composition/${id}/waveform`, { next: { revalidate: 0 } }),
    ]);
    const metadataOk = metaRes.ok;
    const midiOk = midiRes.ok;
    const waveformOk = waveRes.ok;
    base.renderer = {
      ok: metadataOk && midiOk && waveformOk,
      metadataOk,
      midiOk,
      waveformOk,
      error:
        metadataOk && midiOk && waveformOk
          ? undefined
          : `meta:${metaRes.status} midi:${midiRes.status} waveform:${waveRes.status}`,
    };
  } catch (e) {
    base.renderer = {
      ok: false,
      metadataOk: false,
      midiOk: false,
      waveformOk: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const bridgeConfigured = Boolean(process.env.KOJI_BRIDGE_ADDRESS || process.env.LZ_ENDPOINT_ADDRESS);
  base.bridge = bridgeConfigured
    ? {
        ok: base.starknet.ok && base.renderer.ok,
        note: base.starknet.ok
          ? "Bridge is configured; monitor delivery in LayerZero Scan."
          : "Bridge is configured, waiting for Starknet mint confirmation.",
      }
    : {
        ok: false,
        note: "Bridge address / endpoint env not configured on this deployment.",
      };

  const solRpc = getSolanaRpcUrl();
  const kojiProgram = getKojiProgramId();
  if (!solRpc || !kojiProgram) {
    base.solana = {
      ok: false,
      note: "Set SOLANA_RPC_URL and KOJI_PROGRAM_ID (or KOJI_RECEIVER_PROGRAM_ID) for on-chain mint detection.",
    };
  } else {
    try {
      const maxScan = Number(process.env.SOLANA_MINT_SCAN_MAX ?? "200");
      const mint = await findMintKojiSignatureForComposition(solRpc, kojiProgram, compositionId, {
        maxSignatures: Number.isFinite(maxScan) && maxScan > 0 ? maxScan : 200,
      });
      if (mint.found) {
        base.solana = {
          ok: true,
          note: "Found successful mint_koji for this composition id.",
          signature: mint.signature,
        };
      } else {
        base.solana = {
          ok: false,
          note: `No mint_koji in last ${Number.isFinite(maxScan) && maxScan > 0 ? maxScan : 200} program signatures (relayer may not have run yet, or increase SOLANA_MINT_SCAN_MAX).`,
        };
      }
    } catch (e) {
      base.solana = {
        ok: false,
        note: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return NextResponse.json(base);
}
