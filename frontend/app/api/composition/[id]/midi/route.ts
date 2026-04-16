import { NextResponse } from "next/server";

import { fetchCompositionMidiBytes } from "@/lib/koji-starknet";
import { getKojiComposerAddress, getStarknetRpcUrl } from "@/lib/starknet-env";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const contract = getKojiComposerAddress();
  if (!getStarknetRpcUrl() || !contract) {
    return new NextResponse(null, { status: 503 });
  }

  let compositionId: bigint;
  try {
    compositionId = BigInt(params.id);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const bytes = await fetchCompositionMidiBytes(contract, compositionId);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "audio/midi",
        "Content-Disposition": `inline; filename="koji_${params.id}.mid"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
