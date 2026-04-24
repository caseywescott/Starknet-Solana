import { NextResponse } from "next/server";
import { fetchCompositionMidiBytes } from "@/lib/koji-starknet";
import { renderMidiWaveformPng } from "@/lib/midi-viz";
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
    const midi = await fetchCompositionMidiBytes(contract, compositionId);
    const png = renderMidiWaveformPng(midi);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
