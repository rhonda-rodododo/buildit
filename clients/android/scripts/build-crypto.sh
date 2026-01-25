#!/usr/bin/env bash
# Build script for buildit-crypto native library and Kotlin bindings
#
# Prerequisites:
# - Rust toolchain: rustup
# - Android NDK targets: rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
# - cargo-ndk: cargo install cargo-ndk
# - ANDROID_NDK_HOME environment variable set

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CRYPTO_PROJECT_DIR="$ANDROID_PROJECT_DIR/../../packages/crypto"

# Output directories
KOTLIN_OUTPUT_DIR="$ANDROID_PROJECT_DIR/app/src/main/java"
JNILIB_OUTPUT_DIR="$ANDROID_PROJECT_DIR/app/src/main/jniLibs"

echo "=== BuildIt Crypto Build Script ==="
echo "Crypto project: $CRYPTO_PROJECT_DIR"
echo "Android project: $ANDROID_PROJECT_DIR"
echo ""

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."

    if ! command -v rustc &> /dev/null; then
        echo "ERROR: Rust is not installed. Install via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        exit 1
    fi

    if ! command -v cargo-ndk &> /dev/null; then
        echo "ERROR: cargo-ndk is not installed. Install via: cargo install cargo-ndk"
        exit 1
    fi

    if [ -z "$ANDROID_NDK_HOME" ]; then
        echo "ERROR: ANDROID_NDK_HOME is not set"
        exit 1
    fi

    echo "✓ Prerequisites satisfied"
    echo ""
}

# Install Rust Android targets if not present
install_targets() {
    echo "Checking Rust targets..."

    TARGETS=(
        "aarch64-linux-android"
        "armv7-linux-androideabi"
        "x86_64-linux-android"
    )

    for target in "${TARGETS[@]}"; do
        if ! rustup target list --installed | grep -q "$target"; then
            echo "Installing target: $target"
            rustup target add "$target"
        fi
    done

    echo "✓ All targets installed"
    echo ""
}

# Generate Kotlin bindings
generate_kotlin_bindings() {
    echo "Generating Kotlin bindings..."

    cd "$CRYPTO_PROJECT_DIR"

    # Build the uniffi-bindgen binary
    cargo build --bin uniffi-bindgen

    # Generate Kotlin bindings
    ./target/debug/uniffi-bindgen generate \
        src/buildit_crypto.udl \
        --language kotlin \
        --out-dir "$KOTLIN_OUTPUT_DIR"

    echo "✓ Kotlin bindings generated at $KOTLIN_OUTPUT_DIR"
    echo ""
}

# Build native libraries for all Android ABIs
build_native_libs() {
    echo "Building native libraries..."

    cd "$CRYPTO_PROJECT_DIR"

    # Clean previous builds
    cargo clean

    # Build for all Android ABIs using cargo-ndk
    cargo ndk \
        -t armeabi-v7a \
        -t arm64-v8a \
        -t x86_64 \
        -o "$JNILIB_OUTPUT_DIR" \
        build --release

    echo "✓ Native libraries built at $JNILIB_OUTPUT_DIR"
    echo ""
}

# Verify output files
verify_output() {
    echo "Verifying output..."

    # Check Kotlin files
    if [ -f "$KOTLIN_OUTPUT_DIR/buildit_crypto/buildit_crypto.kt" ]; then
        echo "✓ Kotlin bindings: buildit_crypto.kt"
    else
        echo "✗ Missing: buildit_crypto.kt"
    fi

    # Check native libraries
    ABIS=("armeabi-v7a" "arm64-v8a" "x86_64")
    for abi in "${ABIS[@]}"; do
        LIB_PATH="$JNILIB_OUTPUT_DIR/$abi/libbuildit_crypto.so"
        if [ -f "$LIB_PATH" ]; then
            SIZE=$(du -h "$LIB_PATH" | cut -f1)
            echo "✓ Native lib ($abi): $SIZE"
        else
            echo "✗ Missing: libbuildit_crypto.so ($abi)"
        fi
    done

    echo ""
}

# Print usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  all       Build everything (default)"
    echo "  bindings  Generate Kotlin bindings only"
    echo "  libs      Build native libraries only"
    echo "  check     Check prerequisites only"
    echo "  verify    Verify output files"
    echo ""
}

# Main
case "${1:-all}" in
    all)
        check_prerequisites
        install_targets
        generate_kotlin_bindings
        build_native_libs
        verify_output
        echo "=== Build Complete ==="
        ;;
    bindings)
        generate_kotlin_bindings
        ;;
    libs)
        check_prerequisites
        install_targets
        build_native_libs
        ;;
    check)
        check_prerequisites
        install_targets
        ;;
    verify)
        verify_output
        ;;
    *)
        usage
        exit 1
        ;;
esac
