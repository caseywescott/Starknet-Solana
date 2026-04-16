import Link from "next/link";
import { type ReactNode } from "react";

import { SolanaProviders } from "./SolanaProviders";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SolanaProviders>
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-koji-line bg-koji-panel/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight text-koji-accent">
              Koji
            </Link>
            <nav className="flex gap-6 text-sm text-koji-muted">
              <Link href="/" className="hover:text-white">
                Compose
              </Link>
              <Link href="/gallery" className="hover:text-white">
                Gallery
              </Link>
            </nav>
          </div>
        </header>
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</div>
      </div>
    </SolanaProviders>
  );
}
