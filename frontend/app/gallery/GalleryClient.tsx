"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { GalleryItem } from "@/lib/gallery-types";
import { decodeScale } from "@/lib/deserialize";
import { fetchMidiForPlayback } from "@/lib/fetch-midi-with-fallback";
import { playMidiBuffer } from "@/lib/tone-play-midi";

const SCALES = ["Major", "Minor", "Dorian", "Phrygian", "Lydian", "Mixolydian", "Locrian"];

export function GalleryClient() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [scale, setScale] = useState<string>("");
  const [density, setDensity] = useState<string>("");
  const [bpmMin, setBpmMin] = useState<string>("");
  const [bpmMax, setBpmMax] = useState<string>("");
  const [playErr, setPlayErr] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (scale !== "") p.set("scale", scale);
    if (density !== "") p.set("density", density);
    if (bpmMin !== "") p.set("bpmMin", bpmMin);
    if (bpmMax !== "") p.set("bpmMax", bpmMax);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [scale, density, bpmMin, bpmMax]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/gallery${query}`);
      const j = (await res.json()) as { items?: GalleryItem[]; error?: string };
      if (!res.ok) setErr(j.error ?? res.statusText);
      setItems(j.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const play = async (id: string) => {
    setPlayErr(null);
    try {
      const buf = await fetchMidiForPlayback(`/api/composition/${id}/midi`);
      await playMidiBuffer(buf);
    } catch (e) {
      setPlayErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">Gallery</h1>
        <p className="mt-2 text-sm text-koji-muted">
          Compositions indexed from Starknet via <code className="text-koji-accent">composition_count</code>{" "}
          and <code className="text-koji-accent">get_composition</code> (PRD §8.2).
        </p>
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl border border-koji-line bg-koji-panel p-4">
        <label className="text-xs text-koji-muted">
          Scale
          <select
            className="mt-1 block rounded-md border border-koji-line bg-koji-bg px-2 py-1.5 text-sm text-white"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
          >
            <option value="">Any</option>
            {SCALES.map((_, i) => (
              <option key={i} value={String(i)}>
                {decodeScale(i)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-koji-muted">
          Density
          <select
            className="mt-1 block rounded-md border border-koji-line bg-koji-bg px-2 py-1.5 text-sm text-white"
            value={density}
            onChange={(e) => setDensity(e.target.value)}
          >
            <option value="">Any</option>
            {Array.from({ length: 16 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-koji-muted">
          BPM min
          <input
            type="number"
            className="mt-1 block w-24 rounded-md border border-koji-line bg-koji-bg px-2 py-1.5 text-sm text-white"
            value={bpmMin}
            onChange={(e) => setBpmMin(e.target.value)}
            min={60}
            max={240}
          />
        </label>
        <label className="text-xs text-koji-muted">
          BPM max
          <input
            type="number"
            className="mt-1 block w-24 rounded-md border border-koji-line bg-koji-bg px-2 py-1.5 text-sm text-white"
            value={bpmMax}
            onChange={(e) => setBpmMax(e.target.value)}
            min={60}
            max={240}
          />
        </label>
      </div>

      {playErr && <p className="text-sm text-red-300">{playErr}</p>}
      {loading && <p className="text-koji-muted">Loading…</p>}
      {err && <p className="text-sm text-amber-200">{err}</p>}

      {!loading && items.length === 0 && !err && (
        <p className="text-koji-muted">No compositions yet (or filters exclude all).</p>
      )}

      <ul className="grid gap-6 sm:grid-cols-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="overflow-hidden rounded-xl border border-koji-line bg-koji-panel shadow-lg shadow-black/20"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/composition/${it.id}/waveform`}
              alt=""
              className="h-28 w-full bg-koji-bg object-cover"
            />
            <div className="space-y-2 p-4">
              <div className="font-medium text-white">Koji #{it.id}</div>
              <div className="text-xs text-koji-muted">
                {it.scaleName} · density {it.rhythm_density} · {it.bpm} BPM
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => play(it.id)}
                  className="rounded-md border border-koji-accent/40 px-3 py-1.5 text-xs text-koji-accent hover:bg-koji-line/40"
                >
                  Play
                </button>
                <Link
                  href={`/mint/${it.id}`}
                  className="rounded-md border border-koji-line px-3 py-1.5 text-xs text-koji-muted hover:text-white"
                >
                  Mint status
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
