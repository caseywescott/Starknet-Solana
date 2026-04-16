import { readFileSync } from "node:fs";

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";
import { RpcProvider } from "starknet";

dotenv.config({ path: ".env.local" });
dotenv.config();

function need(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(path, "utf8"))),
  );
}

async function main() {
  const mode = (process.env.PRECHECK_MODE ?? "full").toLowerCase();
  if (mode !== "full" && mode !== "solana") {
    throw new Error("PRECHECK_MODE must be `full` or `solana`");
  }

  const solanaRpc = need("SOLANA_RPC_URL");
  const relayerKeypairPath = need("RELAYER_KEYPAIR");
  const programIdStr = need("KOJI_PROGRAM_ID");

  console.log("[preflight] loading relayer keypair...");
  const relayer = loadKeypair(relayerKeypairPath);
  const programId = new PublicKey(programIdStr);

  console.log(`[preflight] relayer pubkey: ${relayer.publicKey.toBase58()}`);
  console.log(`[preflight] program id: ${programId.toBase58()}`);

  if (mode === "full") {
    const starknetRpc = process.env.STARKNET_RPC_PRIMARY ?? process.env.STARKNET_RPC_URL;
    if (!starknetRpc) {
      throw new Error("Missing STARKNET_RPC_PRIMARY (or STARKNET_RPC_URL)");
    }
    const bridgeAddress = need("KOJI_BRIDGE_ADDRESS");
    const bridgePub = BigInt(bridgeAddress);
    console.log(`[preflight] bridge address: 0x${bridgePub.toString(16)}`);

    console.log("[preflight] checking Starknet RPC...");
    const sn = new RpcProvider({ nodeUrl: starknetRpc });
    const snBlock = await sn.getBlockNumber();
    console.log(`[preflight] Starknet latest block: ${snBlock}`);
  } else {
    console.log("[preflight] mode=solana (skipping Starknet checks)");
  }

  console.log("[preflight] checking Solana RPC...");
  const sol = new Connection(solanaRpc, "confirmed");
  const slot = await sol.getSlot("confirmed");
  console.log(`[preflight] Solana current slot: ${slot}`);

  console.log("[preflight] checking Solana program account...");
  const acc = await sol.getAccountInfo(programId, "confirmed");
  if (!acc || !acc.executable) {
    throw new Error(`Program ${programId.toBase58()} not found/executable on this cluster`);
  }
  console.log("[preflight] program account is executable");

  console.log("[preflight] OK");
}

main().catch((err) => {
  console.error("[preflight] failed:", err);
  process.exit(1);
});
