import { NextResponse } from "next/server";

import { decodeScale, fetchComposition } from "@/lib/koji-starknet";
import { getKojiComposerAddress, getRendererBaseUrl, getStarknetRpcUrl } from "@/lib/starknet-env";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const contract = getKojiComposerAddress();
  if (!getStarknetRpcUrl() || !contract) {
    return NextResponse.json(
      {
        error: "Configure STARKNET_RPC_PRIMARY (or STARKNET_RPC_URL) and KOJI_COMPOSER_ADDRESS",
      },
      { status: 503 },
    );
  }

  let compositionId: bigint;
  try {
    compositionId = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid composition id" }, { status: 400 });
  }

  try {
    const comp = await fetchComposition(contract, compositionId);
    const base = getRendererBaseUrl();
    const idStr = params.id;

    return NextResponse.json(
      {
        name: `Koji #${idStr}`,
        description:
          `On-chain generative composition. Computed live from Starknet contract state. Composition ID: ${idStr}.`,
        animation_url: `${base}/api/composition/${idStr}/midi`,
        image: `${base}/api/composition/${idStr}/waveform`,
        external_url: `${base}/composition/${idStr}`,
        attributes: [
          { trait_type: "Scale", value: decodeScale(comp.scale) },
          { trait_type: "Rhythm Density", value: comp.rhythm_density },
          { trait_type: "BPM", value: comp.bpm },
          { trait_type: "Seed", value: `0x${comp.seed.toString(16)}` },
          { trait_type: "Origin Chain", value: "Starknet" },
          { trait_type: "Block", value: Number(comp.block_number) },
          { trait_type: "Composition ID", value: idStr },
        ],
        properties: {
          starknet_contract: contract,
          midi_derived_from: "starknet_view:get_composition_midi",
          renderer_version: "0.2",
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
