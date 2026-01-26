// CertificatePinning.swift
// BuildIt - Decentralized Mesh Communication
//
// Certificate pinning for Nostr relay connections to prevent MITM attacks.
// Supports pre-configured pins and Trust-on-First-Use (TOFU).

import Foundation
import CommonCrypto
import os.log

/// Certificate pinning configuration
struct CertPinConfig: Codable {
    /// Whether TOFU is enabled for unknown relays
    var tofuEnabled: Bool = true

    /// Whether to warn (vs block) when TOFU certificate changes
    var tofuWarnOnChange: Bool = true

    /// Whether write operations require pinned certificates
    var requirePinnedForWrite: Bool = true

    /// Days before pins should be refreshed
    var pinExpiryDays: Int = 365
}

/// Configuration for a single relay's certificate pins
struct RelayPinConfig: Codable {
    /// Primary certificate pins (SHA-256 fingerprints)
    var pins: [String]

    /// Backup pins for certificate rotation
    var backupPins: [String]

    /// When this pin was last verified
    var lastVerified: Date?

    /// Optional notes
    var notes: String?

    enum CodingKeys: String, CodingKey {
        case pins
        case backupPins = "backup_pins"
        case lastVerified = "last_verified"
        case notes
    }
}

/// Result of certificate verification
enum CertVerifyResult {
    /// Certificate matched a known pin
    case pinned

    /// Certificate matched a TOFU pin
    case tofu

    /// First use of this certificate (TOFU)
    case tofuFirstUse

    /// TOFU certificate changed (warning mode)
    case tofuChanged(previous: String, current: String)
}

/// Errors from certificate pinning
enum CertPinError: Error, LocalizedError {
    case pinMismatch(host: String, expected: [String], actual: String)
    case tofuCertificateChanged(host: String, previous: String, current: String)
    case noCertificate
    case invalidCertificate(String)
    case storageError(String)
    case configError(String)

    var errorDescription: String? {
        switch self {
        case .pinMismatch(let host, let expected, let actual):
            return "Certificate pin mismatch for \(host): expected \(expected.joined(separator: ", ")), got \(actual)"
        case .tofuCertificateChanged(let host, let previous, let current):
            return "Certificate changed for TOFU host \(host): was \(previous), now \(current)"
        case .noCertificate:
            return "No certificate provided by server"
        case .invalidCertificate(let msg):
            return "Invalid certificate: \(msg)"
        case .storageError(let msg):
            return "Pin storage error: \(msg)"
        case .configError(let msg):
            return "Configuration error: \(msg)"
        }
    }
}

/// Certificate pin store and verification
class CertificatePinStore {
    private let logger = Logger(subsystem: "com.buildit", category: "CertificatePinning")

    /// Configuration
    private(set) var config: CertPinConfig

    /// Pre-configured relay pins
    private var knownPins: [String: RelayPinConfig] = [:]

    /// TOFU pins (learned at runtime)
    private var tofuPins: [String: String] = [:]

    /// Queue for thread-safe access
    private let queue = DispatchQueue(label: "com.buildit.certpinstore")

    /// UserDefaults key for TOFU pins
    private let tofuDefaultsKey = "com.buildit.tofu.pins"

    /// Shared instance
    static let shared = CertificatePinStore()

    private init() {
        self.config = CertPinConfig()
        loadKnownPins()
        loadTofuPins()
    }

    /// Initialize with custom config
    init(config: CertPinConfig) {
        self.config = config
        loadKnownPins()
        loadTofuPins()
    }

    // MARK: - Pin Loading

    /// Load known pins from bundled configuration
    private func loadKnownPins() {
        // Load from bundled relay-pins.json if available
        if let url = Bundle.main.url(forResource: "relay-pins", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let relays = json["relays"] as? [String: Any] {

            for (relayUrl, pinData) in relays {
                if let pinDict = pinData as? [String: Any] {
                    var pinConfig = RelayPinConfig(pins: [], backupPins: [])

                    if let pins = pinDict["pins"] as? [String] {
                        pinConfig.pins = pins
                    }
                    if let backupPins = pinDict["backup_pins"] as? [String] {
                        pinConfig.backupPins = backupPins
                    }
                    if let notes = pinDict["notes"] as? String {
                        pinConfig.notes = notes
                    }

                    knownPins[relayUrl] = pinConfig
                }
            }

            logger.info("Loaded \(self.knownPins.count) known relay pins")
        }
    }

    /// Load TOFU pins from UserDefaults
    private func loadTofuPins() {
        if let data = UserDefaults.standard.data(forKey: tofuDefaultsKey),
           let pins = try? JSONDecoder().decode([String: String].self, from: data) {
            tofuPins = pins
            logger.info("Loaded \(self.tofuPins.count) TOFU pins")
        }
    }

    /// Save TOFU pins to UserDefaults
    private func saveTofuPins() {
        if let data = try? JSONEncoder().encode(tofuPins) {
            UserDefaults.standard.set(data, forKey: tofuDefaultsKey)
        }
    }

    // MARK: - Pin Management

    /// Add a known relay pin
    func addKnownPin(url: String, config: RelayPinConfig) {
        queue.sync {
            knownPins[url] = config
        }
    }

    /// Compute SHA-256 fingerprint of a certificate
    static func computeFingerprint(_ certificateData: Data) -> String {
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        certificateData.withUnsafeBytes { bytes in
            _ = CC_SHA256(bytes.baseAddress, CC_LONG(certificateData.count), &hash)
        }
        return "sha256/" + Data(hash).base64EncodedString()
    }

    /// Compute fingerprint from SecCertificate
    static func computeFingerprint(_ certificate: SecCertificate) -> String? {
        guard let data = SecCertificateCopyData(certificate) as Data? else {
            return nil
        }
        return computeFingerprint(data)
    }

    // MARK: - Verification

    /// Verify a certificate against known or TOFU pins
    func verifyCertificate(host: String, certificateData: Data) -> Result<CertVerifyResult, CertPinError> {
        let fingerprint = Self.computeFingerprint(certificateData)
        let normalizedHost = normalizeHost(host)

        return queue.sync {
            // Check known pins first
            if let pinConfig = knownPins[normalizedHost] {
                let allPins = pinConfig.pins + pinConfig.backupPins

                if !allPins.isEmpty {
                    if allPins.contains(fingerprint) {
                        return .success(.pinned)
                    } else {
                        return .failure(.pinMismatch(
                            host: normalizedHost,
                            expected: allPins,
                            actual: fingerprint
                        ))
                    }
                }
                // Empty pins = known relay but no pins configured yet, fall through to TOFU
            }

            // Check TOFU pins
            if config.tofuEnabled {
                if let storedPin = tofuPins[normalizedHost] {
                    if storedPin == fingerprint {
                        return .success(.tofu)
                    } else {
                        // Certificate changed!
                        if config.tofuWarnOnChange {
                            logger.warning("Certificate changed for TOFU host \(normalizedHost): was \(storedPin), now \(fingerprint)")
                            return .success(.tofuChanged(previous: storedPin, current: fingerprint))
                        } else {
                            return .failure(.tofuCertificateChanged(
                                host: normalizedHost,
                                previous: storedPin,
                                current: fingerprint
                            ))
                        }
                    }
                }

                // First time seeing this host - store the pin
                tofuPins[normalizedHost] = fingerprint
                saveTofuPins()
                logger.info("TOFU: Stored initial certificate pin for \(normalizedHost): \(fingerprint)")
                return .success(.tofuFirstUse)
            }

            // No TOFU enabled and no known pins
            return .failure(.configError("No certificate pin configured for \(normalizedHost) and TOFU is disabled"))
        }
    }

    /// Verify a SecCertificate
    func verifyCertificate(host: String, certificate: SecCertificate) -> Result<CertVerifyResult, CertPinError> {
        guard let data = SecCertificateCopyData(certificate) as Data? else {
            return .failure(.invalidCertificate("Could not extract certificate data"))
        }
        return verifyCertificate(host: host, certificateData: data)
    }

    /// Check if a relay is pinned (known or TOFU)
    func isPinned(host: String) -> Bool {
        let normalizedHost = normalizeHost(host)

        return queue.sync {
            if let config = knownPins[normalizedHost], !config.pins.isEmpty {
                return true
            }
            return tofuPins[normalizedHost] != nil
        }
    }

    /// Clear TOFU pin for a specific host
    func clearTofuPin(host: String) {
        let normalizedHost = normalizeHost(host)
        queue.sync {
            tofuPins.removeValue(forKey: normalizedHost)
            saveTofuPins()
        }
    }

    /// Normalize host URL
    private func normalizeHost(_ host: String) -> String {
        if host.hasPrefix("wss://") || host.hasPrefix("ws://") {
            return host
        }
        return "wss://\(host)"
    }
}

// MARK: - URLSession Delegate for Certificate Pinning

/// URLSession delegate that implements certificate pinning
class PinnedURLSessionDelegate: NSObject, URLSessionDelegate {
    private let pinStore: CertificatePinStore
    private let logger = Logger(subsystem: "com.buildit", category: "CertificatePinning")

    /// Callback for certificate verification results
    var onCertificateVerified: ((String, CertVerifyResult) -> Void)?

    /// Callback for certificate verification failures
    var onCertificateError: ((String, CertPinError) -> Void)?

    init(pinStore: CertificatePinStore = .shared) {
        self.pinStore = pinStore
        super.init()
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        let host = challenge.protectionSpace.host

        // Get the leaf certificate
        guard SecTrustGetCertificateCount(serverTrust) > 0 else {
            logger.error("No certificates in server trust for \(host)")
            onCertificateError?(host, .noCertificate)
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // Get certificate at index 0 (leaf certificate)
        guard let certificate = SecTrustCopyCertificateChain(serverTrust)?[0] else {
            logger.error("Could not get leaf certificate for \(host)")
            onCertificateError?(host, .noCertificate)
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // Verify against our pins
        let result = pinStore.verifyCertificate(host: host, certificate: certificate as! SecCertificate)

        switch result {
        case .success(let verifyResult):
            logger.info("Certificate verified for \(host): \(String(describing: verifyResult))")
            onCertificateVerified?(host, verifyResult)

            // Create credential and accept
            let credential = URLCredential(trust: serverTrust)
            completionHandler(.useCredential, credential)

        case .failure(let error):
            logger.error("Certificate pinning failed for \(host): \(error.localizedDescription)")
            onCertificateError?(host, error)
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}

// MARK: - WebSocket Task Delegate

/// WebSocket task delegate with certificate pinning
class PinnedWebSocketDelegate: NSObject, URLSessionWebSocketDelegate {
    private let pinStore: CertificatePinStore
    private let logger = Logger(subsystem: "com.buildit", category: "CertificatePinning")

    var onOpen: (() -> Void)?
    var onClose: ((URLSessionWebSocketTask.CloseCode, Data?) -> Void)?
    var onCertificateVerified: ((String, CertVerifyResult) -> Void)?
    var onCertificateError: ((String, CertPinError) -> Void)?

    init(pinStore: CertificatePinStore = .shared) {
        self.pinStore = pinStore
        super.init()
    }

    // Handle server trust challenge with certificate pinning
    nonisolated func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        let host = challenge.protectionSpace.host

        // Get the certificate chain
        guard let certificateChain = SecTrustCopyCertificateChain(serverTrust),
              CFArrayGetCount(certificateChain) > 0 else {
            Task { @MainActor in
                self.logger.error("No certificates in server trust for \(host)")
                self.onCertificateError?(host, .noCertificate)
            }
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // Get leaf certificate
        let certificate = (certificateChain as [AnyObject])[0] as! SecCertificate

        // Verify against our pins
        let result = pinStore.verifyCertificate(host: host, certificate: certificate)

        switch result {
        case .success(let verifyResult):
            Task { @MainActor in
                self.logger.info("Certificate verified for \(host)")
                self.onCertificateVerified?(host, verifyResult)
            }
            let credential = URLCredential(trust: serverTrust)
            completionHandler(.useCredential, credential)

        case .failure(let error):
            Task { @MainActor in
                self.logger.error("Certificate pinning failed for \(host): \(error.localizedDescription)")
                self.onCertificateError?(host, error)
            }
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        Task { @MainActor in
            self.onOpen?()
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        Task { @MainActor in
            self.onClose?(closeCode, reason)
        }
    }
}
