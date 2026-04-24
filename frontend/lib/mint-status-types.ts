export type MintStatusPayload = {
  compositionId: string;
  starknet: { ok: boolean; error?: string };
  renderer: {
    ok: boolean;
    metadataOk: boolean;
    midiOk: boolean;
    waveformOk: boolean;
    error?: string;
  };
  bridge: { ok: boolean; note: string };
  solana: { ok: boolean; note: string; signature?: string };
};
