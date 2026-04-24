#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/prewarm-renderer.sh \
    --base-url <RENDERER_BASE_URL> \
    --ids <CSV_IDS_OR_RANGE>

Examples:
  ./scripts/prewarm-renderer.sh --base-url https://koji.xyz --ids 1,2,3
  ./scripts/prewarm-renderer.sh --base-url http://localhost:3000 --ids 1-10

Env fallbacks:
  RENDERER_BASE_URL
EOF
}

BASE_URL="${RENDERER_BASE_URL:-}"
IDS_SPEC=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"; shift 2 ;;
    --ids)
      IDS_SPEC="${2:-}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 1 ;;
  esac
done

if [[ -z "$BASE_URL" || -z "$IDS_SPEC" ]]; then
  echo "Missing required args: --base-url and --ids" >&2
  usage
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not found in PATH." >&2
  exit 1
fi

BASE_URL="${BASE_URL%/}"

expand_ids() {
  local spec="$1"
  local parts=()
  local token start end i
  IFS=',' read -r -a parts <<<"$spec"
  for token in "${parts[@]}"; do
    token="$(echo "$token" | tr -d '[:space:]')"
    [[ -z "$token" ]] && continue
    if [[ "$token" =~ ^[0-9]+-[0-9]+$ ]]; then
      start="${token%-*}"
      end="${token#*-}"
      if (( start > end )); then
        echo "Invalid range: $token" >&2
        return 1
      fi
      for (( i=start; i<=end; i++ )); do
        echo "$i"
      done
    elif [[ "$token" =~ ^[0-9]+$ ]]; then
      echo "$token"
    else
      echo "Invalid id token: $token" >&2
      return 1
    fi
  done
}

fetch_and_report() {
  local url="$1"
  local label="$2"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" "$url")"
  if [[ "$code" -ge 200 && "$code" -lt 300 ]]; then
    echo "  ✓ $label ($code)"
  else
    echo "  ✗ $label ($code)"
  fi
}

echo "Pre-warming renderer cache at: $BASE_URL"
while IFS= read -r id; do
  [[ -z "$id" ]] && continue
  echo "Composition $id"
  fetch_and_report "$BASE_URL/api/composition/$id" "metadata"
  fetch_and_report "$BASE_URL/api/composition/$id/midi" "midi"
  fetch_and_report "$BASE_URL/api/composition/$id/waveform" "waveform"
done < <(expand_ids "$IDS_SPEC")

echo "Done."
