#!/usr/bin/env bash
# Refresh vendored Metaplex mpl-core ELF from mainnet (read-only RPC; no devnet rent).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "${ROOT}/testfixtures"
solana program dump CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d \
  "${ROOT}/testfixtures/mpl_core.so" \
  -u https://api.mainnet-beta.solana.com
