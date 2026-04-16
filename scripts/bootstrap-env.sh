#!/usr/bin/env bash
set -euo pipefail

# Generate env snippets for frontend + relayer after contract/program deploys.

usage() {
  cat <<'EOF'
Usage:
  ./scripts/bootstrap-env.sh \
    --composer <STARKNET_COMPOSER_ADDRESS> \
    --bridge <STARKNET_BRIDGE_ADDRESS> \
    --solana-program <SOLANA_PROGRAM_ID> \
    [--renderer-base <URL>] \
    [--starknet-rpc <URL>] \
    [--starknet-rpc-fallback <URL>] \
    [--solana-rpc <URL>] \
    [--output <PATH_TO_ENV_FILE>]

Env fallbacks:
  KOJI_COMPOSER_ADDRESS, KOJI_BRIDGE_ADDRESS, KOJI_PROGRAM_ID/KOJI_RECEIVER_PROGRAM_ID,
  RENDERER_BASE_URL, STARKNET_RPC_PRIMARY/STARKNET_RPC_URL, STARKNET_RPC_FALLBACK, SOLANA_RPC_URL

Examples:
  ./scripts/bootstrap-env.sh \
    --composer 0x0123... \
    --bridge 0x0456... \
    --solana-program 8SAW... \
    --renderer-base https://koji.xyz \
    --output .env.local

  ./scripts/bootstrap-env.sh --composer 0x... --bridge 0x... --solana-program 8SAW...
EOF
}

COMPOSER="${KOJI_COMPOSER_ADDRESS:-}"
BRIDGE="${KOJI_BRIDGE_ADDRESS:-}"
SOLANA_PROGRAM="${KOJI_PROGRAM_ID:-${KOJI_RECEIVER_PROGRAM_ID:-}}"
RENDERER_BASE="${RENDERER_BASE_URL:-http://localhost:3000}"
STARKNET_RPC="${STARKNET_RPC_PRIMARY:-${STARKNET_RPC_URL:-}}"
STARKNET_RPC_FALLBACK="${STARKNET_RPC_FALLBACK:-}"
SOLANA_RPC="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
OUTPUT_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --composer) COMPOSER="${2:-}"; shift 2 ;;
    --bridge) BRIDGE="${2:-}"; shift 2 ;;
    --solana-program) SOLANA_PROGRAM="${2:-}"; shift 2 ;;
    --renderer-base) RENDERER_BASE="${2:-}"; shift 2 ;;
    --starknet-rpc) STARKNET_RPC="${2:-}"; shift 2 ;;
    --starknet-rpc-fallback) STARKNET_RPC_FALLBACK="${2:-}"; shift 2 ;;
    --solana-rpc) SOLANA_RPC="${2:-}"; shift 2 ;;
    --output) OUTPUT_PATH="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$COMPOSER" || -z "$BRIDGE" || -z "$SOLANA_PROGRAM" ]]; then
  echo "Missing required values: composer, bridge, solana-program" >&2
  usage
  exit 1
fi

ENV_BLOCK="$(cat <<EOF
# ---- Koji generated env bootstrap ----
STARKNET_RPC_PRIMARY=$STARKNET_RPC
STARKNET_RPC_URL=$STARKNET_RPC
STARKNET_RPC_FALLBACK=$STARKNET_RPC_FALLBACK
KOJI_COMPOSER_ADDRESS=$COMPOSER
KOJI_BRIDGE_ADDRESS=$BRIDGE

RENDERER_BASE_URL=$RENDERER_BASE
NEXT_PUBLIC_RENDERER_BASE_URL=$RENDERER_BASE

SOLANA_RPC_URL=$SOLANA_RPC
KOJI_RECEIVER_PROGRAM_ID=$SOLANA_PROGRAM
KOJI_PROGRAM_ID=$SOLANA_PROGRAM
# ---- end Koji generated env bootstrap ----
EOF
)"

if [[ -n "$OUTPUT_PATH" ]]; then
  printf "%s\n" "$ENV_BLOCK" >"$OUTPUT_PATH"
  echo "Wrote env bootstrap to $OUTPUT_PATH"
else
  printf "%s\n" "$ENV_BLOCK"
fi
