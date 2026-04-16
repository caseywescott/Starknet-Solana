"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import type { MintStatusPayload } from "@/lib/mint-status-types";
import { getLzScanUrl, getSolanaClusterExplorerBase, getStarknetTxExplorerUrl } from "@/lib/chain-config";
import { fetchMidiForPlayback } from "@/lib/fetch-midi-with-fallback";
import { playMidiBuffer } from "@/lib/tone-play-midi";

type Props = { compositionId: string };

export function MintStatusClient({ compositionId }: Props) {
  const [data, setData] = useState<MintStatusPayload | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [playErr, setPlayErr] = useState<string | null>(null);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/mint-status/${compositionId}`);
    const j = (await res.json()) as MintStatusPayload;
    setData(j);
  }, [compositionId]);

  useEffect(() => {
    void poll();
    const id = setInterval(() => void poll(), 4000);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    const h = sessionStorage.getItem(`koji_mint_tx_${compositionId}`);
    if (h) setTxHash(h);
  }, [compositionId]);

  const onPlayMinted = async () => {
    setPlayErr(null);
    try {
      const buf = await fetchMidiForPlayback(`/api/composition/${compositionId}/midi`);
      await playMidiBuffer(buf);
    } catch (e) {
      setPlayErr(e instanceof Error ? e.message : String(e));
    }
  };

  const lz = getLzScanUrl();
  const solBase = getSolanaClusterExplorerBase();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Mint status</h1>
        <p className="mt-1 font-mono text-sm text-koji-accent">Koji #{compositionId}</p>
      </div>

      <ol className="space-y-4">
        <Step
          done={data?.starknet.ok === true}
          title="Composition stored on Starknet"
          detail={
            txHash ? (
              <a
                className="text-koji-accent underline"
                href={getStarknetTxExplorerUrl(txHash)}
                target="_blank"
                rel="noreferrer"
              >
                View transaction
              </a>
            ) : (
              "Connect your wallet flow stores the latest tx in session when returning from compose."
            )
          }
        />
        <Step
          done={data?.renderer.ok === true}
          title="Renderer verified"
          detail="GET /api/composition/:id returns metadata JSON."
        />
        <Step
          done={false}
          title="Bridging via LayerZero"
          detail={
            lz ? (
              <a className="text-koji-accent underline" href={lz} target="_blank" rel="noreferrer">
                Open LayerZero scan
              </a>
            ) : (
              "Set NEXT_PUBLIC_LAYERZERO_SCAN_URL for a quick link."
            )
          }
        />
        <Step
          done={false}
          title="NFT on Solana"
          detail={
            <span>
              Check{" "}
              <a className="text-koji-accent underline" href={solBase} target="_blank" rel="noreferrer">
                Solana explorer
              </a>{" "}
              after the relayer mints Metaplex Core.
            </span>
          }
        />
      </ol>

      {data?.starknet.ok === false && data.starknet.error && (
        <p className="text-sm text-amber-200">{data.starknet.error}</p>
      )}

      <div className="rounded-xl border border-koji-line bg-koji-panel p-6">
        <h2 className="text-sm font-medium text-koji-muted">On-chain MIDI (renderer)</h2>
        <button
          type="button"
          onClick={onPlayMinted}
          className="mt-3 rounded-lg border border-koji-accent/40 px-4 py-2 text-sm text-koji-accent hover:bg-koji-line/30"
        >
          Play MIDI (Tone.js)
        </button>
        <p className="mt-2 text-xs text-koji-muted">
          If the chain still returns a tiny stub SMF, playback uses the bundled fallback file (
          <code className="text-koji-accent">/test.mid</code>).
        </p>
        {playErr && <p className="mt-2 text-sm text-red-300">{playErr}</p>}
        <div className="mt-4 overflow-hidden rounded-lg border border-koji-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/composition/${compositionId}/waveform`}
            alt="Waveform placeholder"
            className="h-24 w-full bg-koji-bg object-cover"
          />
        </div>
      </div>

      <Link href="/gallery" className="text-sm text-koji-accent underline">
        Open gallery
      </Link>
    </div>
  );
}

function Step({
  done,
  title,
  detail,
}: {
  done: boolean;
  title: string;
  detail: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-lg border border-koji-line bg-koji-bg/60 p-4">
      <span className="mt-0.5 text-lg">{done ? "✓" : "…"}</span>
      <div>
        <div className="font-medium text-white">{title}</div>
        <div className="mt-1 text-sm text-koji-muted">{detail}</div>
      </div>
    </li>
  );
}
