#!/usr/bin/env bash
# bump-version.sh — Sync a semver version string across all platform files.
#
# Usage: ./scripts/bump-version.sh 0.2.0
#
# Updates:
#   clients/desktop/tauri.conf.json  (source of truth)
#   clients/desktop/Cargo.toml
#   clients/android/app/build.gradle.kts
#   clients/web/package.json
#   package.json (root)

set -euo pipefail

VERSION="${1:?Usage: $0 <semver>}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Validate semver format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: '$VERSION' is not valid semver (expected X.Y.Z)" >&2
    exit 1
fi

MAJOR="${VERSION%%.*}"
MINOR="${VERSION#*.}" && MINOR="${MINOR%.*}"
PATCH="${VERSION##*.}"

echo "Bumping version to $VERSION (major=$MAJOR minor=$MINOR patch=$PATCH)"

# --- Tauri config (source of truth) ---
TAURI_CONF="$REPO_ROOT/clients/desktop/tauri.conf.json"
if [[ -f "$TAURI_CONF" ]]; then
    sed -i "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"$VERSION\"/" "$TAURI_CONF"
    echo "  Updated $TAURI_CONF"
else
    echo "  Warning: $TAURI_CONF not found" >&2
fi

# --- Desktop Cargo.toml ---
CARGO_TOML="$REPO_ROOT/clients/desktop/Cargo.toml"
if [[ -f "$CARGO_TOML" ]]; then
    # Only replace the top-level version, not dependency versions
    sed -i "0,/^version = \"[0-9]*\.[0-9]*\.[0-9]*\"/s//version = \"$VERSION\"/" "$CARGO_TOML"
    echo "  Updated $CARGO_TOML"
else
    echo "  Warning: $CARGO_TOML not found" >&2
fi

# --- Android build.gradle.kts ---
GRADLE="$REPO_ROOT/clients/android/app/build.gradle.kts"
if [[ -f "$GRADLE" ]]; then
    VERSION_CODE=$((MAJOR * 10000 + MINOR * 100 + PATCH))
    sed -i "s/versionCode = [0-9]*/versionCode = $VERSION_CODE/" "$GRADLE"
    sed -i "s/versionName = \"[0-9]*\.[0-9]*\.[0-9]*\"/versionName = \"$VERSION\"/" "$GRADLE"
    echo "  Updated $GRADLE (versionCode=$VERSION_CODE)"
else
    echo "  Warning: $GRADLE not found" >&2
fi

# --- Web client package.json ---
WEB_PKG="$REPO_ROOT/clients/web/package.json"
if [[ -f "$WEB_PKG" ]]; then
    sed -i "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"$VERSION\"/" "$WEB_PKG"
    echo "  Updated $WEB_PKG"
else
    echo "  Warning: $WEB_PKG not found" >&2
fi

# --- Root package.json ---
ROOT_PKG="$REPO_ROOT/package.json"
if [[ -f "$ROOT_PKG" ]]; then
    sed -i "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"$VERSION\"/" "$ROOT_PKG"
    echo "  Updated $ROOT_PKG"
else
    echo "  Warning: $ROOT_PKG not found" >&2
fi

echo "Done. All version files updated to $VERSION"
