// FederationSettingsView.swift
// BuildIt - Federation settings for ActivityPub and Bluesky

import SwiftUI

/// Federation settings view with toggles for AP and AT Protocol
struct FederationSettingsView: View {
    @State private var apEnabled = false
    @State private var atEnabled = false
    @State private var blueskyHandle = ""
    @State private var loading = true

    var body: some View {
        List {
            // ActivityPub Section
            Section {
                Toggle(isOn: $apEnabled) {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("ActivityPub (Fediverse)")
                                .font(.body)
                            Text("Share posts with Mastodon, Misskey, and other servers")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "globe")
                            .foregroundStyle(.purple)
                    }
                }
                .accessibilityHint("Toggle ActivityPub federation to share posts with the fediverse")
            } header: {
                Text("ActivityPub")
                    .accessibilityAddTraits(.isHeader)
            }

            // Bluesky Section
            Section {
                Toggle(isOn: $atEnabled) {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Bluesky (AT Protocol)")
                                .font(.body)
                            Text("Cross-post to your Bluesky account")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "cloud")
                            .foregroundStyle(.blue)
                    }
                }
                .accessibilityHint("Toggle Bluesky federation to cross-post to Bluesky")

                if atEnabled {
                    TextField("Bluesky Handle", text: $blueskyHandle)
                        .textContentType(.username)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .accessibilityLabel("Bluesky handle")
                        .accessibilityHint("Enter your Bluesky handle, for example yourname.bsky.social")

                    Text("Use an App Password from Bluesky settings — never your main password.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("Bluesky")
                    .accessibilityAddTraits(.isHeader)
            }

            // Privacy Notice
            Section {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "lock.shield")
                        .foregroundStyle(.yellow)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Privacy")
                            .font(.caption.bold())
                        Text("Only explicitly public posts are federated. Encrypted messages, DMs, and group-only content are never shared.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Federation")
        .task {
            await loadStatus()
        }
    }

    private func loadStatus() async {
        // In production, this would fetch from the federation worker API
        loading = false
    }
}

#if DEBUG
struct FederationSettingsView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            FederationSettingsView()
        }
    }
}
#endif
