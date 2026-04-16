/**
 * Default: `anchor test` starts a fresh local `solana-test-validator`, deploys `koji_receiver`,
 * and loads Metaplex mpl-core from `[[test.genesis]]` in `Anchor.toml` (no devnet rent).
 *
 * Optional — Surfpool or any local RPC: ensure mpl-core exists at `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`,
 * deploy this program, then run:
 *   ANCHOR_PROVIDER_URL=http://127.0.0.1:<rpc-port> anchor test --skip-local-validator --skip-build
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import BN from "bn.js";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import type { KojiReceiver } from "../target/types/koji_receiver";

/** Metaplex mpl-core (same program id on mainnet / devnet). */
const MPL_CORE_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

describe("koji_receiver (local validator)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .KojiReceiver as Program<KojiReceiver>;

  it("initialize then mint_koji (Metaplex Core CPI)", async () => {
    const wallet = provider.wallet as anchor.Wallet;

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("koji_cfg")],
      program.programId
    );

    await program.methods
      .initialize("https://renderer.example")
      .accountsStrict({
        config: configPda,
        relayer: wallet.publicKey,
        payer: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cfg = await program.account.kojiConfig.fetch(configPda);
    expect(cfg.relayer.toBase58()).to.eq(wallet.publicKey.toBase58());
    expect(cfg.rendererBase).to.eq("https://renderer.example");

    const asset = Keypair.generate();
    const owner = Keypair.generate();

    const sig = await program.methods
      .mintKoji(
        new BN(42),
        new BN("170141183460469231731687303715884105727", 10),
        new BN(1),
        5,
        8,
        128
      )
      .accountsStrict({
        config: configPda,
        relayer: wallet.publicKey,
        payer: wallet.publicKey,
        asset: asset.publicKey,
        mplCoreProgram: MPL_CORE_ID,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([asset])
      .rpc();

    expect(sig.length).to.be.greaterThan(0);
  });
});
