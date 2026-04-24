# Hackathon Submission Note - Koji

## Title

Koji: Deterministic Cross-Chain Generative Music NFTs (Starknet + Solana)

## Problem

Generative music NFT projects are usually locked to one chain, or copied across chains in ways that break provenance and collector trust. Artists then face a tradeoff: reach the audience where they already collect, or keep technical integrity.

## Your idea

Koji treats Cairo/Starknet as the canonical composition layer and Solana as a high-distribution mint surface. A user mints from a Starknet-origin flow, composition parameters are recorded as source-of-truth, and a relayed mint creates a Solana NFT whose metadata/audio are deterministically derived from the same canonical inputs.

The core principle is one deterministic spec, thin chain adapters, and verifiable metadata parity.

## Why now

- Multi-chain collector behavior is already real; artists need credible presence where liquidity and communities already exist.
- My deterministic generative systems are now mature enough to make reproducibility a product feature.
- The market is shifting from pure mint hype toward trust, provenance, and execution reliability.
- Starknet and Solana together offer a compelling split: programmable composition integrity plus fast consumer-facing mint distribution.

## How it could work (light execution plan)

1. **Canonical spec lock**: finalize seed/trait/score/metadata canonicalization (already decision-locked in this vault).
2. **Starknet composer path**: harden Cairo composer + bridge contracts and event schema on testnet.
3. **Relay + Solana mint path**: productionize relayer listener/retry logic and ensure receiver program mints with deterministic attributes.
4. **Renderer reliability**: stabilize metadata, MIDI, and waveform endpoints with RPC fallback and preflight checks.
5. **Cross-chain verification**: publish deterministic test vectors and parity checks so judges/collectors can verify output consistency.
6. **Demo-ready flow**: mint from UI -> observe Starknet state -> trigger relay -> verify Solana NFT + metadata/audio endpoints.
