/** Server-only env for API routes (set in `.env.local`). */

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

export function getStarknetRpcUrl(): string | undefined {
  return process.env.STARKNET_RPC_PRIMARY ?? process.env.STARKNET_RPC_URL;
}

export function getStarknetRpcFallback(): string | undefined {
  return process.env.STARKNET_RPC_FALLBACK;
}

export function getKojiComposerAddress(): string | undefined {
  return process.env.KOJI_COMPOSER_ADDRESS;
}

export function getRendererBaseUrl(): string {
  return (
    process.env.RENDERER_BASE_URL ??
    process.env.NEXT_PUBLIC_RENDERER_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
