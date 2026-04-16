import { NextResponse } from "next/server";

import { fetchCompositionCount } from "@/lib/koji-starknet";
import { getKojiComposerAddress, getStarknetRpcUrl } from "@/lib/starknet-env";

export async function GET() {
  const contract = getKojiComposerAddress();
  if (!getStarknetRpcUrl() || !contract) {
    return NextResponse.json(
      { error: "Server not configured for Starknet RPC / composer address" },
      { status: 503 },
    );
  }
  try {
    const count = await fetchCompositionCount(contract);
    return NextResponse.json({ count: count.toString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
