import Foundation
import SwiftUI

// MARK: - String Localization Extensions

public extension String {
    /// Localize a string key using NSLocalizedString
    var localized: String {
        NSLocalizedString(self, comment: "")
    }

    /// Localize a string key with arguments
    func localized(_ args: CVarArg...) -> String {
        String(format: NSLocalizedString(self, comment: ""), arguments: args)
    }

    /// Localize a string key with a specific table
    func localized(table: String, bundle: Bundle = .main) -> String {
        NSLocalizedString(self, tableName: table, bundle: bundle, comment: "")
    }
}

// MARK: - SwiftUI Text Extensions

public extension Text {
    /// Initialize Text with a localized string key
    init(localized key: String) {
        self.init(LocalizedStringKey(key))
    }

    /// Initialize Text with a localized string key and arguments
    init(localized key: String, _ args: CVarArg...) {
        let format = NSLocalizedString(key, comment: "")
        let formatted = String(format: format, arguments: args)
        self.init(formatted)
    }
}

// MARK: - Bundle Extension for Localization

public extension Bundle {
    /// Get the preferred language code from user settings
    static var preferredLanguageCode: String {
        Locale.preferredLanguages.first?.components(separatedBy: "-").first ?? "en"
    }

    /// Check if the app supports a specific locale
    static func supportsLocale(_ locale: String) -> Bool {
        let supportedLocales = ["en", "es", "fr", "ar", "zh-Hans", "vi", "ko", "ru", "pt", "ht", "tl"]
        return supportedLocales.contains(locale)
    }
}

// MARK: - Locale Extension

public extension Locale {
    /// Get a display name for a locale code
    static func displayName(for localeCode: String) -> String {
        let locale = Locale(identifier: localeCode)
        return locale.localizedString(forIdentifier: localeCode) ?? localeCode
    }

    /// Supported app locales
    static let supportedAppLocales: [String] = [
        "en",      // English
        "es",      // Spanish
        "fr",      // French
        "ar",      // Arabic
        "zh-Hans", // Chinese (Simplified)
        "vi",      // Vietnamese
        "ko",      // Korean
        "ru",      // Russian
        "pt",      // Portuguese
        "ht",      // Haitian Creole
        "tl",      // Tagalog
    ]
}
