#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOLANA_DIR="${ROOT}/solana"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy-solana.sh \
    [--cluster <devnet|localnet|mainnet>] \
    [--provider-url <RPC_URL>] \
    [--wallet <KEYPAIR_PATH>] \
    [--skip-build]

Env fallbacks:
  SOLANA_CLUSTER, ANCHOR_PROVIDER_URL, ANCHOR_WALLET

Examples:
  ./scripts/deploy-solana.sh --cluster devnet
  ./scripts/deploy-solana.sh --cluster devnet --wallet ~/.config/solana/id.json
  ./scripts/deploy-solana.sh --provider-url http://127.0.0.1:8899 --skip-build
EOF
}

CLUSTER="${SOLANA_CLUSTER:-devnet}"
PROVIDER_URL="${ANCHOR_PROVIDER_URL:-}"
WALLET="${ANCHOR_WALLET:-}"
SKIP_BUILD="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cluster)
      CLUSTER="${2:-}"; shift 2 ;;
    --provider-url)
      PROVIDER_URL="${2:-}"; shift 2 ;;
    --wallet)
      WALLET="${2:-}"; shift 2 ;;
    --skip-build)
      SKIP_BUILD="1"; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 1 ;;
  esac
done

if ! command -v anchor >/dev/null 2>&1; then
  echo "anchor CLI is required but not found in PATH." >&2
  exit 1
fi
if ! command -v solana >/dev/null 2>&1; then
  echo "solana CLI is required but not found in PATH." >&2
  exit 1
fi

ANCHOR_ARGS=()
if [[ -n "$PROVIDER_URL" ]]; then
  ANCHOR_ARGS+=(--provider.url "$PROVIDER_URL")
fi
if [[ -n "$WALLET" ]]; then
  ANCHOR_ARGS+=(--provider.wallet "$WALLET")
fi

SOLANA_URL=""
if [[ -n "$PROVIDER_URL" ]]; then
  SOLANA_URL="$PROVIDER_URL"
else
  case "$CLUSTER" in
    devnet) SOLANA_URL="https://api.devnet.solana.com" ;;
    mainnet) SOLANA_URL="https://api.mainnet-beta.solana.com" ;;
    localnet) SOLANA_URL="http://127.0.0.1:8899" ;;
    *)
      echo "Unsupported cluster: $CLUSTER (expected devnet|mainnet|localnet)" >&2
      exit 1
      ;;
  esac
fi

echo "Deploying Solana program from ${SOLANA_DIR}"
echo "  cluster: $CLUSTER"
echo "  rpc:     $SOLANA_URL"
if [[ -n "$WALLET" ]]; then
  echo "  wallet:  $WALLET"
fi

if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "Running anchor build ..."
  (
    cd "$SOLANA_DIR"
    anchor build "${ANCHOR_ARGS[@]}"
  )
fi

echo "Running anchor deploy ..."
DEPLOY_OUT="$(
  cd "$SOLANA_DIR" && \
  anchor deploy "${ANCHOR_ARGS[@]}"
)"
echo "$DEPLOY_OUT"

PROGRAM_ID="$(awk '/koji_receiver/ {print $NF}' "$SOLANA_DIR/Anchor.toml" | tail -n1 | tr -d '"')"
if [[ -z "$PROGRAM_ID" ]]; then
  echo "Failed to parse koji_receiver program id from Anchor.toml" >&2
  exit 1
fi

echo "Verifying deployed program account ..."
solana program show "$PROGRAM_ID" --url "$SOLANA_URL"

cat <<EOF
Deploy complete:
  KOJI_PROGRAM_ID=$PROGRAM_ID

Next steps:
  - Set relayer env: KOJI_PROGRAM_ID=$PROGRAM_ID
  - Initialize on-chain config via Anchor/TS client:
      initialize(renderer_base)
EOF
