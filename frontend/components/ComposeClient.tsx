"use client";

import { connect, disconnect } from "@starknet-io/get-starknet";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import type { StarknetWindowObject } from "@starknet-io/types-js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { hash } from "starknet";

import { EuclideanDots } from "@/components/EuclideanDots";
import { getPublicComposerAddress, getStarknetTxExplorerUrl } from "@/lib/chain-config";
import { getFallbackMidiUrl } from "@/lib/fetch-midi-with-fallback";
import { u256ToCalldata } from "@/lib/koji-starknet";
import { buildPreviewMidi } from "@/lib/preview-midi";
import { pubkeyToFeltString } from "@/lib/pubkey-to-felt";
import { suggestedSeedHex } from "@/lib/seed-from-address";
import { playMidiBuffer } from "@/lib/tone-play-midi";

const SCALES = [
  "Major",
  "Minor",
  "Dorian",
  "Phrygian",
  "Lydian",
  "Mixolydian",
  "Locrian",
] as const;

function parseSeed(s: string): bigint {
  const t = s.trim();
  if (!t) return 0n;
  if (/^0x/i.test(t)) return BigInt(t);
  return BigInt(t);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function ComposeClient() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const composer = getPublicComposerAddress();

  const [starknet, setStarknet] = useState<StarknetWindowObject | null>(null);
  const [starknetAddress, setStarknetAddress] = useState<string | null>(null);
  const [seedStr, setSeedStr] = useState("0x0");
  const [seedTouched, setSeedTouched] = useState(false);
  const [scale, setScale] = useState(0);
  const [density, setDensity] = useState(4);
  const [bpm, setBpm] = useState(120);
  const [solanaRecipient, setSolanaRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const stopAudio = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (publicKey && !solanaRecipient) {
      setSolanaRecipient(publicKey.toBase58());
    }
  }, [publicKey, solanaRecipient]);

  useEffect(() => {
    if (starknetAddress && !seedTouched) {
      setSeedStr(suggestedSeedHex(starknetAddress));
    }
  }, [starknetAddress, seedTouched]);

  const onConnectStarknet = useCallback(async () => {
    setError(null);
    try {
      const w = await connect({ modalTheme: "dark" });
      if (!w) return;
      const addrs = await w.request({ type: "wallet_requestAccounts" });
      setStarknet(w);
      setStarknetAddress(addrs[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onDisconnectStarknet = useCallback(async () => {
    await disconnect();
    setStarknet(null);
    setStarknetAddress(null);
  }, []);

  const onPreview = useCallback(async () => {
    setError(null);
    stopAudio.current?.();
    stopAudio.current = null;
    try {
      const preview = buildPreviewMidi({
        seed: parseSeed(seedStr),
        scale,
        density,
        bpm,
      });
      stopAudio.current = await playMidiBuffer(preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [seedStr, scale, density, bpm]);

  const onPlaySampleMidi = useCallback(async () => {
    setError(null);
    stopAudio.current?.();
    stopAudio.current = null;
    try {
      const url = getFallbackMidiUrl();
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Sample MIDI ${url} returned ${r.status}`);
      stopAudio.current = await playMidiBuffer(await r.arrayBuffer());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onComposeMint = useCallback(async () => {
    setError(null);
    setLastTx(null);
    if (!starknet || !composer) {
      setError(!composer ? "Set NEXT_PUBLIC_KOJI_COMPOSER_ADDRESS" : "Connect a Starknet wallet");
      return;
    }
    try {
      new PublicKey(solanaRecipient.trim());
    } catch {
      setError("Invalid Solana recipient address");
      return;
    }

    setBusy(true);
    try {
      const countRes = await fetch("/api/chain/composition-count");
      if (!countRes.ok) {
        throw new Error("Could not read composition count (check server env / RPC).");
      }
      const { count } = (await countRes.json()) as { count: string };
      const countBefore = BigInt(count);

      const [lo, hi] = u256ToCalldata(parseSeed(seedStr));
      const solFelt = pubkeyToFeltString(solanaRecipient.trim());
      const calldata = [lo, hi, String(scale), String(density), String(bpm), solFelt];

      const res = await starknet.request({
        type: "wallet_addInvokeTransaction",
        params: {
          calls: [
            {
              contract_address: composer,
              entry_point: hash.getSelectorFromName("compose_and_mint"),
              calldata,
            },
          ],
        },
      });

      const txHash = res.transaction_hash;
      setLastTx(txHash);

      const deadline = Date.now() + 120_000;
      let newCount = countBefore;
      while (Date.now() < deadline) {
        await sleep(1500);
        const r = await fetch("/api/chain/composition-count");
        if (!r.ok) continue;
        const j = (await r.json()) as { count: string };
        const c = BigInt(j.count);
        if (c > countBefore) {
          newCount = c;
          break;
        }
      }
      if (newCount <= countBefore) {
        throw new Error("Transaction submitted but composition count did not increase yet.");
      }
      const idStr = newCount.toString();
      sessionStorage.setItem(`koji_mint_tx_${idStr}`, txHash);
      router.push(`/mint/${idStr}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [starknet, composer, seedStr, scale, density, bpm, solanaRecipient, router]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Compose</h1>
        <p className="mt-2 max-w-2xl text-sm text-koji-muted">
          Connect Starknet to mint on-chain, Solana (Phantom) for recipient convenience. Preview uses
          a client-side pattern (PRD §8.3 placeholder until the TS parser matches Cairo). Playback uses
          Tone.js. Gallery and mint status fall back to <code className="text-koji-accent">public/test.mid</code>{" "}
          when the API returns a stub or errors (override with{" "}
          <code className="text-koji-accent">NEXT_PUBLIC_FALLBACK_MIDI_URL</code>).
        </p>
      </div>

      <section className="grid gap-8 rounded-xl border border-koji-line bg-koji-panel p-6 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-koji-muted">Wallets</h2>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {!starknet ? (
                <button
                  type="button"
                  onClick={onConnectStarknet}
                  className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
                >
                  Connect Starknet
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-koji-line bg-koji-bg px-3 py-1.5 font-mono text-xs text-koji-accent">
                    {starknetAddress}
                  </span>
                  <button
                    type="button"
                    onClick={onDisconnectStarknet}
                    className="text-sm text-koji-muted underline hover:text-white"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs text-koji-muted">Solana recipient (NFT owner)</p>
              <div className="flex flex-wrap items-center gap-3">
                <WalletMultiButton className="!bg-zinc-100 !font-medium !text-zinc-900" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-koji-muted">Parameters</h2>
          <label className="block text-xs text-koji-muted">
            Seed (u256 hex or decimal)
            <input
              className="mt-1 w-full rounded-md border border-koji-line bg-koji-bg px-3 py-2 font-mono text-sm text-white"
              value={seedStr}
              onChange={(e) => {
                setSeedTouched(true);
                setSeedStr(e.target.value);
              }}
            />
          </label>
          <label className="block text-xs text-koji-muted">
            Scale
            <select
              className="mt-1 w-full rounded-md border border-koji-line bg-koji-bg px-3 py-2 text-sm text-white"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            >
              {SCALES.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <div className="flex justify-between text-xs text-koji-muted">
              <span>Rhythm density</span>
              <span>{density}</span>
            </div>
            <input
              type="range"
              min={1}
              max={16}
              value={density}
              onChange={(e) => setDensity(Number(e.target.value))}
              className="mt-2 w-full accent-koji-accent"
            />
            <div className="mt-3">
              <EuclideanDots density={density} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-koji-muted">
              <span>BPM</span>
              <span>{bpm}</span>
            </div>
            <input
              type="range"
              min={60}
              max={240}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="mt-2 w-full accent-koji-accent"
            />
          </div>
          <label className="block text-xs text-koji-muted">
            Solana recipient address
            <input
              className="mt-1 w-full rounded-md border border-koji-line bg-koji-bg px-3 py-2 font-mono text-sm text-white"
              value={solanaRecipient}
              onChange={(e) => setSolanaRecipient(e.target.value)}
              placeholder="Base58 pubkey"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-koji-line bg-koji-panel p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-koji-muted">Preview & mint</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onPreview}
            className="rounded-lg border border-koji-accent/40 bg-koji-bg px-4 py-2 text-sm font-medium text-koji-accent hover:bg-koji-line/40"
          >
            Play preview (Tone.js)
          </button>
          <button
            type="button"
            onClick={onPlaySampleMidi}
            className="rounded-lg border border-koji-line px-4 py-2 text-sm text-koji-muted hover:border-koji-accent/30 hover:text-white"
          >
            Play sample MIDI ({getFallbackMidiUrl()})
          </button>
          <button
            type="button"
            disabled={busy || !starknet || !composer}
            onClick={onComposeMint}
            className="rounded-lg bg-koji-accent px-4 py-2 text-sm font-semibold text-koji-bg hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Submitting…" : "Compose & mint"}
          </button>
        </div>
        {!composer && (
          <p className="mt-3 text-xs text-amber-200/90">
            Configure <code className="text-amber-100">NEXT_PUBLIC_KOJI_COMPOSER_ADDRESS</code> for
            minting.
          </p>
        )}
        {lastTx && (
          <p className="mt-3 text-xs">
            <span className="text-koji-muted">Last tx: </span>
            <a
              href={getStarknetTxExplorerUrl(lastTx)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-koji-accent underline"
            >
              {lastTx.slice(0, 10)}…
            </a>
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </section>

      <section className="rounded-xl border border-dashed border-koji-line p-6 text-sm text-koji-muted">
        <strong className="text-zinc-300">Waveform</strong> — PRD §8.1 uses wavesurfer.js; the renderer
        still serves a placeholder PNG at <code className="text-koji-accent">/api/composition/[id]/waveform</code>.
      </section>
    </div>
  );
}
