export type MintStatusPayload = {
  compositionId: string;
  starknet: { ok: boolean; error?: string };
  renderer: { ok: boolean; error?: string };
  bridge: { note: string };
  solana: { note: string };
};
