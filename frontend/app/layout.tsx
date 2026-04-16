import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";

import { AppShell } from "@/components/AppShell";

import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Koji",
  description: "Cross-chain generative music NFTs (Starknet → Solana)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} font-sans`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
