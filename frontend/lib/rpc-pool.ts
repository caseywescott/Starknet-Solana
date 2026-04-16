import { RpcProvider } from "starknet";

/** PRD §7.7 — try primary RPC, then fallback. */
export async function callWithFallback<T>(
  primaryUrl: string | undefined,
  fallbackUrl: string | undefined,
  fn: (provider: RpcProvider) => Promise<T>,
): Promise<T> {
  const urls = [primaryUrl, fallbackUrl].filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
  if (urls.length === 0) {
    throw new Error("No Starknet RPC URL configured");
  }
  let lastErr: unknown;
  for (const url of urls) {
    try {
      return await fn(new RpcProvider({ nodeUrl: url }));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
