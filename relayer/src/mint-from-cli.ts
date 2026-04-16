/**
 * Submit `mint_koji` (one-shot). Run after `anchor deploy` with matching program id.
 *
 * Usage:
 *   SOLANA_RPC_URL=... RELAYER_KEYPAIR=~/.config/solana/id.json \
 *   KOJI_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS \
 *   npx tsx src/mint-from-cli.ts <COMPOSITION_ID> <SEED_LO> <SEED_HI> <SCALE> <DENSITY> <BPM> <OWNER_PUBKEY> <ASSET_KEYPAIR_JSON>
 *
 * `ASSET_KEYPAIR_JSON` path to a fresh keypair JSON for the Metaplex Core asset account (signer).
 */
import { readFileSync } from "node:fs";

import { Keypair, PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";

import { submitMintKoji } from "./mint.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 7) {
    console.error("Args: compositionId seedLo seedHi scale density bpm ownerPubkey [assetKeypairJson]");
    process.exit(1);
  }

  const [
    compS,
    seedLoS,
    seedHiS,
    scaleS,
    densityS,
    bpmS,
    ownerS,
    assetKpPathMaybe,
  ] = argv;

  const asset = assetKpPathMaybe
    ? Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(readFileSync(assetKpPathMaybe, "utf8"))),
      )
    : Keypair.generate();
  const owner = new PublicKey(ownerS);

  const sig = await submitMintKoji({
    compositionId: BigInt(compS),
    seedLo: BigInt(seedLoS),
    seedHi: BigInt(seedHiS),
    scale: Number(scaleS),
    rhythmDensity: Number(densityS),
    bpm: Number(bpmS),
    owner,
    asset,
  });
  console.log("mint_koji ok:", sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
