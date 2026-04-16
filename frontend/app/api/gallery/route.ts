import { NextResponse } from "next/server";

import type { GalleryItem } from "@/lib/gallery-types";
import { decodeScale, fetchComposition, fetchCompositionCount } from "@/lib/koji-starknet";
import { getKojiComposerAddress, getStarknetRpcUrl } from "@/lib/starknet-env";

export async function GET(request: Request) {
  const contract = getKojiComposerAddress();
  if (!getStarknetRpcUrl() || !contract) {
    return NextResponse.json(
      { error: "Configure STARKNET_RPC_PRIMARY and KOJI_COMPOSER_ADDRESS", items: [] },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const scaleFilter = searchParams.get("scale");
  const densityFilter = searchParams.get("density");
  const bpmMin = searchParams.get("bpmMin");
  const bpmMax = searchParams.get("bpmMax");

  try {
    const count = await fetchCompositionCount(contract);
    const n = Number(count);
    const max = Math.min(n, 256);
    const items: GalleryItem[] = [];

    for (let i = 1; i <= max; i++) {
      const comp = await fetchComposition(contract, BigInt(i));
      if (scaleFilter !== null && String(comp.scale) !== scaleFilter) continue;
      if (densityFilter !== null && String(comp.rhythm_density) !== densityFilter) continue;
      if (bpmMin !== null && comp.bpm < Number(bpmMin)) continue;
      if (bpmMax !== null && comp.bpm > Number(bpmMax)) continue;

      items.push({
        id: String(i),
        seed: `0x${comp.seed.toString(16)}`,
        scale: comp.scale,
        scaleName: decodeScale(comp.scale),
        rhythm_density: comp.rhythm_density,
        bpm: comp.bpm,
        composer_starknet: comp.composer_starknet,
        block_number: comp.block_number.toString(),
      });
    }

    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message, items: [] }, { status: 502 });
  }
}
