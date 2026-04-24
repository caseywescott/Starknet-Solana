/** Server-only env for Solana RPC checks (API routes). */

export function getSolanaRpcUrl(): string | undefined {
  return process.env.SOLANA_RPC_URL;
}

export function getKojiProgramId(): string | undefined {
  return process.env.KOJI_PROGRAM_ID ?? process.env.KOJI_RECEIVER_PROGRAM_ID;
}
