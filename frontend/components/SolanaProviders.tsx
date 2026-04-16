"use client";

import { type Adapter, WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";
import { type ComponentType, type ReactNode, useMemo } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";

function pickNetwork(): WalletAdapterNetwork {
  const c = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
  if (c === "mainnet-beta") return WalletAdapterNetwork.Mainnet;
  if (c === "testnet") return WalletAdapterNetwork.Testnet;
  return WalletAdapterNetwork.Devnet;
}

function pickEndpoint(network: WalletAdapterNetwork): string {
  const custom = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (custom) return custom;
  if (network === WalletAdapterNetwork.Mainnet) return clusterApiUrl("mainnet-beta");
  if (network === WalletAdapterNetwork.Testnet) return clusterApiUrl("testnet");
  return clusterApiUrl("devnet");
}

/** Wallet adapter types target React 19 `FC`; we stay on React 18 types for Next 14. */
const ConnectionRoot = ConnectionProvider as unknown as ComponentType<{
  endpoint: string;
  children?: ReactNode;
}>;
const WalletRoot = WalletProvider as unknown as ComponentType<{
  wallets: Adapter[];
  autoConnect?: boolean;
  children?: ReactNode;
}>;
const ModalRoot = WalletModalProvider as unknown as ComponentType<{ children?: ReactNode }>;

export function SolanaProviders({ children }: { children: ReactNode }) {
  const network = useMemo(() => pickNetwork(), []);
  const endpoint = useMemo(() => pickEndpoint(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionRoot endpoint={endpoint}>
      <WalletRoot wallets={wallets} autoConnect>
        <ModalRoot>{children}</ModalRoot>
      </WalletRoot>
    </ConnectionRoot>
  );
}
