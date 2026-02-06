package network.buildit.core

import android.util.Log

/**
 * Privacy-safe logging utilities for BuildIt.
 *
 * SECURITY: In a privacy-first activist organizing tool, full pubkeys in logs
 * create metadata that can be extracted from a seized device via USB debug (logcat)
 * or from crash reports. Truncating identifiers to the first 8 characters provides
 * sufficient debuggability while preventing full identity correlation.
 *
 * Usage:
 *   Log.d(TAG, "Connected to peer: ${pubkey.redacted()}")
 *   // Output: "Connected to peer: a1b2c3d4..."
 */

/**
 * Truncate a pubkey/identifier for safe logging.
 * Shows only the first 8 characters followed by "..." to prevent
 * full identity leakage in device logs.
 */
fun String.redacted(): String {
    if (length <= 8) return this
    return "${take(8)}..."
}
