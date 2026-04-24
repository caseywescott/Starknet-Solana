#!/usr/bin/env bash
set -euo pipefail

# Register/update bridge destination config on Starknet.
# Current KojiBridge exposes `set_destination(dst_eid, dst_peer)` and `get_destination()`.
# This script keeps naming aligned with LayerZero peer setup even while send path is stubbed.

usage() {
  cat <<'EOF'
Usage:
  ./scripts/register-lz-peers.sh \
    --bridge <STARKNET_BRIDGE_ADDRESS> \
    --endpoint <LZ_ENDPOINT_CONTRACT_ADDRESS> \
    --dst-eid <SOLANA_EID_U32> \
    --dst-peer <SOLANA_PEER_AS_FELT252> \
    [--account <SNCAST_ACCOUNT>] \
    [--network <SNCAST_NETWORK>]

Env fallbacks:
  KOJI_BRIDGE_ADDRESS, LZ_ENDPOINT_ADDRESS, LZ_SOLANA_EID, LZ_SOLANA_PEER, SNCAST_ACCOUNT, SNCAST_NETWORK

Example:
  ./scripts/register-lz-peers.sh \
    --bridge 0x0123... \
    --endpoint 0x0789... \
    --dst-eid 40168 \
    --dst-peer 0x0456... \
    --account default \
    --network sepolia
EOF
}

BRIDGE="${KOJI_BRIDGE_ADDRESS:-}"
ENDPOINT="${LZ_ENDPOINT_ADDRESS:-}"
DST_EID="${LZ_SOLANA_EID:-}"
DST_PEER="${LZ_SOLANA_PEER:-}"
ACCOUNT="${SNCAST_ACCOUNT:-}"
NETWORK="${SNCAST_NETWORK:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bridge)
      BRIDGE="${2:-}"; shift 2 ;;
    --endpoint)
      ENDPOINT="${2:-}"; shift 2 ;;
    --dst-eid)
      DST_EID="${2:-}"; shift 2 ;;
    --dst-peer)
      DST_PEER="${2:-}"; shift 2 ;;
    --account)
      ACCOUNT="${2:-}"; shift 2 ;;
    --network)
      NETWORK="${2:-}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 1 ;;
  esac
done

if ! command -v sncast >/dev/null 2>&1; then
  echo "sncast is required but not found in PATH." >&2
  exit 1
fi

if [[ -z "$BRIDGE" || -z "$ENDPOINT" || -z "$DST_EID" || -z "$DST_PEER" ]]; then
  echo "Missing required args: --bridge, --endpoint, --dst-eid, --dst-peer" >&2
  usage
  exit 1
fi

if ! [[ "$DST_EID" =~ ^[0-9]+$ ]]; then
  echo "--dst-eid must be an unsigned integer (u32)." >&2
  exit 1
fi

SNCAST_ARGS=()
if [[ -n "$ACCOUNT" ]]; then
  SNCAST_ARGS+=(--account "$ACCOUNT")
fi
if [[ -n "$NETWORK" ]]; then
  SNCAST_ARGS+=(--network "$NETWORK")
fi

echo "Setting KojiBridge destination on Starknet..."
echo "  bridge:   $BRIDGE"
echo "  endpoint: $ENDPOINT"
echo "  dst_eid:  $DST_EID"
echo "  dst_peer: $DST_PEER"

sncast invoke \
  --contract-address "$BRIDGE" \
  --function "set_endpoint" \
  --calldata "$ENDPOINT" \
  "${SNCAST_ARGS[@]}"

sncast invoke \
  --contract-address "$BRIDGE" \
  --function "set_destination" \
  --calldata "$DST_EID" "$DST_PEER" \
  "${SNCAST_ARGS[@]}"

echo "Verifying endpoint config..."
sncast call \
  --contract-address "$BRIDGE" \
  --function "get_endpoint" \
  "${SNCAST_ARGS[@]}"

echo "Verifying destination config..."
sncast call \
  --contract-address "$BRIDGE" \
  --function "get_destination" \
  "${SNCAST_ARGS[@]}"

echo "Done."
