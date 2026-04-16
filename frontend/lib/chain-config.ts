export function getPublicComposerAddress(): string | undefined {
  return process.env.NEXT_PUBLIC_KOJI_COMPOSER_ADDRESS;
}

export function getStarknetTxExplorerUrl(txHash: string): string {
  const base =
    process.env.NEXT_PUBLIC_STARKNET_EXPLORER_TX ??
    "https://sepolia.starkscan.co/tx/{hash}";
  return base.replace("{hash}", txHash);
}

export function getLzScanUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_LAYERZERO_SCAN_URL;
}

export function getSolanaClusterExplorerBase(): string {
  return process.env.NEXT_PUBLIC_SOLANA_EXPLORER_BASE ?? "https://explorer.solana.com";
}
