# Koji monorepo

Cross-chain generative music NFT stack (Starknet → Solana) per [koji_prd.md](../koji_prd.md) v0.2.

## Layout

| Path | Role |
|------|------|
| `starknet/` | Scarb package: composer + bridge (depends on [midi_fun_contract](../../midi_fun_contract)) |
| `solana/programs/koji_receiver/` | Anchor program |
| `frontend/` | Next.js app + API renderer + shared `lib/` |
| `relayer/` | Optional manual Starknet → Solana relayer |
| `scripts/` | Deploy / LayerZero helper scripts |

## Quick start (serialization tests)

```bash
cd frontend
npm install
npm test
```

`lib/deserialize.ts` inverts Cairo `koji::midi::output::to_felt252_array` (`midi_fun_contract`). Each payload felt carries **up to `k` bytes** (`k = min(31, remaining)`), not always 31 — that matches Starknet packing and fixes edge cases the PRD §7.5 snippet glosses over.

Copy `.env.example` to `.env.local` when wiring RPC and contract addresses.

## Packages

| Command | Notes |
|---------|--------|
| `cd starknet && scarb build` | Compiles `KojiComposer` + `KojiBridge` contracts |
| `cd midi_fun_contract && scarb test -- --filter test_output` | Cairo `to_felt252_array` tests |
| `cd solana && anchor build` | Builds IDL + `.so` (needs [Anchor](https://www.anchor-lang.com/docs/installation)) |
| `cd solana/programs/koji_receiver && cargo check` | Rust-only check (no `anchor` CLI required) |
| `cd frontend && npm run build` | Next.js 14 + `/api/composition/:id` (+ `/midi`, `/waveform`) |

### Deployment scripts

`scripts/` now includes deploy/bootstrap helpers:

- `deploy-starknet.sh` — build + declare + deploy `KojiBridge`/`KojiComposer` and verify calls.
- `register-lz-peers.sh` — set/verify bridge endpoint + destination config (`endpoint`, `dst_eid`, `dst_peer`) on Starknet.
- `deploy-solana.sh` — build + deploy Anchor `koji_receiver` and verify deployed program account.
- `bootstrap-env.sh` — generate a consistent env block for frontend + relayer from deployed ids.
- `prewarm-renderer.sh` — warm `/api/composition/:id`, `/midi`, `/waveform` edge cache for demo reliability.

Recommended order:

```bash
# 1) Deploy Starknet contracts
./scripts/deploy-starknet.sh --endpoint <LZ_ENDPOINT_ADDRESS> --dst-eid <SOLANA_EID> --dst-peer <SOLANA_PEER_FELT>

# 2) (Optional) update destination config later
./scripts/register-lz-peers.sh --bridge <KOJI_BRIDGE_ADDRESS> --endpoint <LZ_ENDPOINT_ADDRESS> --dst-eid <SOLANA_EID> --dst-peer <SOLANA_PEER_FELT>

# 3) Deploy Solana receiver
./scripts/deploy-solana.sh --cluster devnet

# 4) Generate env wiring for app + relayer
./scripts/bootstrap-env.sh --composer <KOJI_COMPOSER_ADDRESS> --bridge <KOJI_BRIDGE_ADDRESS> --solana-program <KOJI_PROGRAM_ID> --output .env.local

# 5) Pre-warm renderer endpoints for demo compositions
./scripts/prewarm-renderer.sh --base-url https://koji.xyz --ids 1-5
```

### Starknet contracts

| Contract | Role |
|----------|------|
| `bridge::KojiBridge` | Emits `BridgeMintRequested`, stores destination config, exposes `quote_send` stub. |
| `composer::KojiComposer` | Stores params, derives deterministic MIDI on read, calls bridge after mint if bridge ≠ zero. |

Deploy outline:

1. Run `./scripts/deploy-starknet.sh --endpoint <LZ_ENDPOINT_ADDRESS> --dst-eid <SOLANA_EID> --dst-peer <SOLANA_PEER_FELT>`.
2. Capture `KOJI_BRIDGE_ADDRESS` and `KOJI_COMPOSER_ADDRESS` from script output.
3. Optionally adjust bridge destination later with `./scripts/register-lz-peers.sh ...`.
4. Use `./scripts/bootstrap-env.sh ... --output .env.local` to wire frontend/relayer env vars.

### Solana program

**Anchor 0.31.1** + **`mpl-core` 0.11** — `mint_koji` performs **Metaplex Core `CreateV1`** CPI (new asset keypair per mint), sets `name` / `uri` from `renderer_base` + `composition_id`, and attaches PRD §6.1 attributes (`scale`, `rhythm_density`, `bpm`, `seed`, `composition_id`, `origin_chain`). Emits `KojiMintedOnSolana`.

`initialize(renderer_base)` sets the relayer to the initializer signer and seeds config PDA `koji_cfg`.

**Devnet deploy notes:** Use `./scripts/deploy-solana.sh --cluster devnet` (runs `anchor build` + `anchor deploy` + verification). Rent for the program buffer is often **~1.7+ SOL** — fund the wallet in `Anchor.toml` (`solana airdrop 2 <PUBKEY> --url devnet`, repeat if the faucet allows). The program crate declares `idl-build = ["anchor-lang/idl-build"]` for Anchor 0.31 IDL generation.

### Relayer (manual + listener)

After deploy, set `SOLANA_RPC_URL`, `RELAYER_KEYPAIR` (JSON path), `KOJI_PROGRAM_ID` in `relayer/.env` or shell, then:

```bash
cd relayer && npm install
npx tsx src/mint-from-cli.ts <compositionId> <seedLo> <seedHi> <scale> <density> <bpm> <ownerPubkey> [path/to/asset-keypair.json]
```

For automatic relay from Starknet bridge events:

```bash
cd relayer
STARKNET_RPC_PRIMARY=... KOJI_BRIDGE_ADDRESS=0x... npm run listen
```

`listen-bridge-stub.ts` now polls `BridgeMintRequested` and submits `mint_koji`. Treat as beta until tested against deployed bridge/composer on your target testnets.
It also persists cursor state (`RELAYER_STATE_PATH`, default `.relay-state.json`) and retries Solana submits (`RELAYER_MAX_RETRIES`, exponential backoff).
Set `RELAYER_DRY_RUN=1` to parse events and log would-be mints without sending Solana transactions.

Before running the listener, run preflight checks:

```bash
cd relayer
npm run preflight
```

Preflight verifies required env vars, relayer keypair decode (full mode), Starknet/Solana RPC reachability, and that `KOJI_PROGRAM_ID` exists as an executable program account on the configured Solana cluster.
If Starknet is not deployed yet, run Solana-only checks with `npm run preflight:solana` (does not require `RELAYER_KEYPAIR`).

Convenience commands:

```bash
cd relayer
npm run listen:dry   # parse events only, no Solana tx
npm run listen:live  # submit Solana tx
```
