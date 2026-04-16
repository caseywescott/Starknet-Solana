import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { encodeMintKojiIx } from "./anchor-data.js";

const MPL_CORE_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

function cfgPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("koji_cfg")], programId);
}

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(path, "utf8"))),
  );
}

export type MintKojiArgs = {
  compositionId: bigint;
  seedLo: bigint;
  seedHi: bigint;
  scale: number;
  rhythmDensity: number;
  bpm: number;
  owner: PublicKey;
  asset?: Keypair;
};

export async function submitMintKoji(args: MintKojiArgs): Promise<string> {
  const rpc = process.env.SOLANA_RPC_URL;
  const relayerPath = process.env.RELAYER_KEYPAIR;
  const programIdStr = process.env.KOJI_PROGRAM_ID;
  if (!rpc || !relayerPath || !programIdStr) {
    throw new Error("Need SOLANA_RPC_URL, RELAYER_KEYPAIR, KOJI_PROGRAM_ID");
  }

  const programId = new PublicKey(programIdStr);
  const relayer = loadKeypair(relayerPath);
  const asset = args.asset ?? Keypair.generate();
  const [configPda] = cfgPda(programId);

  const data = encodeMintKojiIx({
    compositionId: args.compositionId,
    seedLo: args.seedLo,
    seedHi: args.seedHi,
    scale: args.scale,
    rhythmDensity: args.rhythmDensity,
    bpm: args.bpm,
  });

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: relayer.publicKey, isSigner: true, isWritable: false },
      { pubkey: relayer.publicKey, isSigner: true, isWritable: true },
      { pubkey: asset.publicKey, isSigner: true, isWritable: true },
      { pubkey: MPL_CORE_ID, isSigner: false, isWritable: false },
      { pubkey: args.owner, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const conn = new Connection(rpc, "confirmed");
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(conn, tx, [relayer, asset], {
    commitment: "confirmed",
  });
}
