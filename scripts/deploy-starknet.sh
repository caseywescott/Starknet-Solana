#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STARKNET_DIR="${ROOT}/starknet"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy-starknet.sh \
    --endpoint <LZ_ENDPOINT_CONTRACT_ADDRESS> \
    --dst-eid <SOLANA_EID_U32> \
    --dst-peer <SOLANA_PEER_AS_FELT252> \
    [--account <SNCAST_ACCOUNT>] \
    [--network <SNCAST_NETWORK>] \
    [--bridge-class-hash <CLASS_HASH>] \
    [--composer-class-hash <CLASS_HASH>]

Env fallbacks:
  LZ_ENDPOINT_ADDRESS, LZ_SOLANA_EID, LZ_SOLANA_PEER, SNCAST_ACCOUNT, SNCAST_NETWORK,
  KOJI_BRIDGE_CLASS_HASH, KOJI_COMPOSER_CLASS_HASH

Notes:
  - If class hashes are not provided, this script attempts sncast declare.
  - Bridge constructor args: (endpoint, dst_eid, dst_peer)
  - Composer constructor args: (bridge_address)
EOF
}

ENDPOINT="${LZ_ENDPOINT_ADDRESS:-}"
DST_EID="${LZ_SOLANA_EID:-}"
DST_PEER="${LZ_SOLANA_PEER:-}"
ACCOUNT="${SNCAST_ACCOUNT:-}"
NETWORK="${SNCAST_NETWORK:-}"
BRIDGE_CLASS_HASH="${KOJI_BRIDGE_CLASS_HASH:-}"
COMPOSER_CLASS_HASH="${KOJI_COMPOSER_CLASS_HASH:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
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
    --bridge-class-hash)
      BRIDGE_CLASS_HASH="${2:-}"; shift 2 ;;
    --composer-class-hash)
      COMPOSER_CLASS_HASH="${2:-}"; shift 2 ;;
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
if ! command -v scarb >/dev/null 2>&1; then
  echo "scarb is required but not found in PATH." >&2
  exit 1
fi

if [[ -z "$ENDPOINT" || -z "$DST_EID" || -z "$DST_PEER" ]]; then
  echo "Missing required args: --endpoint, --dst-eid and --dst-peer" >&2
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

extract_field() {
  local text="$1"
  local key="$2"
  awk -v k="$key" '$0 ~ k {print $NF}' <<<"$text" | tail -n1
}

echo "Building Cairo package in ${STARKNET_DIR} ..."
(
  cd "$STARKNET_DIR"
  scarb build
)

if [[ -z "$BRIDGE_CLASS_HASH" ]]; then
  echo "Declaring bridge::KojiBridge ..."
  BRIDGE_DECLARE_OUT="$(
    cd "$STARKNET_DIR" && \
    sncast declare \
      --contract-name "koji_starknet::bridge::KojiBridge" \
      "${SNCAST_ARGS[@]}"
  )"
  echo "$BRIDGE_DECLARE_OUT"
  BRIDGE_CLASS_HASH="$(extract_field "$BRIDGE_DECLARE_OUT" "class hash")"
fi

if [[ -z "$COMPOSER_CLASS_HASH" ]]; then
  echo "Declaring composer::KojiComposer ..."
  COMPOSER_DECLARE_OUT="$(
    cd "$STARKNET_DIR" && \
    sncast declare \
      --contract-name "koji_starknet::composer::KojiComposer" \
      "${SNCAST_ARGS[@]}"
  )"
  echo "$COMPOSER_DECLARE_OUT"
  COMPOSER_CLASS_HASH="$(extract_field "$COMPOSER_DECLARE_OUT" "class hash")"
fi

if [[ -z "$BRIDGE_CLASS_HASH" || -z "$COMPOSER_CLASS_HASH" ]]; then
  echo "Failed to resolve class hashes for bridge/composer." >&2
  exit 1
fi

echo "Deploying KojiBridge with constructor($ENDPOINT, $DST_EID, $DST_PEER) ..."
BRIDGE_DEPLOY_OUT="$(
  cd "$STARKNET_DIR" && \
  sncast deploy \
    --class-hash "$BRIDGE_CLASS_HASH" \
    --constructor-calldata "$ENDPOINT" "$DST_EID" "$DST_PEER" \
    "${SNCAST_ARGS[@]}"
)"
echo "$BRIDGE_DEPLOY_OUT"
BRIDGE_ADDRESS="$(extract_field "$BRIDGE_DEPLOY_OUT" "contract address")"

if [[ -z "$BRIDGE_ADDRESS" ]]; then
  echo "Failed to parse deployed bridge contract address." >&2
  exit 1
fi

echo "Deploying KojiComposer with constructor($BRIDGE_ADDRESS) ..."
COMPOSER_DEPLOY_OUT="$(
  cd "$STARKNET_DIR" && \
  sncast deploy \
    --class-hash "$COMPOSER_CLASS_HASH" \
    --constructor-calldata "$BRIDGE_ADDRESS" \
    "${SNCAST_ARGS[@]}"
)"
echo "$COMPOSER_DEPLOY_OUT"
COMPOSER_ADDRESS="$(extract_field "$COMPOSER_DEPLOY_OUT" "contract address")"

if [[ -z "$COMPOSER_ADDRESS" ]]; then
  echo "Failed to parse deployed composer contract address." >&2
  exit 1
fi

echo "Verifying deployed contracts..."
(
  cd "$STARKNET_DIR"
  sncast call --contract-address "$BRIDGE_ADDRESS" --function "get_destination" "${SNCAST_ARGS[@]}"
  sncast call --contract-address "$BRIDGE_ADDRESS" --function "get_endpoint" "${SNCAST_ARGS[@]}"
  sncast call --contract-address "$COMPOSER_ADDRESS" --function "composition_count" "${SNCAST_ARGS[@]}"
)

cat <<EOF
Deploy complete:
  KOJI_BRIDGE_CLASS_HASH=$BRIDGE_CLASS_HASH
  KOJI_COMPOSER_CLASS_HASH=$COMPOSER_CLASS_HASH
  KOJI_BRIDGE_ADDRESS=$BRIDGE_ADDRESS
  LZ_ENDPOINT_ADDRESS=$ENDPOINT
  KOJI_COMPOSER_ADDRESS=$COMPOSER_ADDRESS
EOF
