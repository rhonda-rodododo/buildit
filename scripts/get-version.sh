#!/usr/bin/env bash
# get-version.sh — Read the current version from tauri.conf.json (source of truth).
#
# Usage: ./scripts/get-version.sh
# Output: 0.1.0

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_CONF="$REPO_ROOT/clients/desktop/tauri.conf.json"

if [[ ! -f "$TAURI_CONF" ]]; then
    echo "Error: $TAURI_CONF not found" >&2
    exit 1
fi

grep -o '"version": "[0-9]*\.[0-9]*\.[0-9]*"' "$TAURI_CONF" | head -1 | sed 's/"version": "//;s/"//'
