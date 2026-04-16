/**
 * Full automation: subscribe to Starknet `BridgeMintRequested` / `CompositionMinted`, submit `mint_koji`.
 *
 * **Manual path (no IDL):** `npm run mint` in this folder — see `src/mint-from-cli.ts` and repo `README.md`.
 *
 * TODO: `starknet.js` event stream + reuse `encodeMintKojiIx` / Anchor client after `anchor build` IDL.
 */
console.warn("[koji-relayer] stub — use `npm run mint` or `src/mint-from-cli.ts` for one-shot mints");
