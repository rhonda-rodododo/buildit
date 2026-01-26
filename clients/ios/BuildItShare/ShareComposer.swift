// ShareComposer.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftUI compose view for the Share Extension.
// Allows selecting a destination and adding a message before sharing.

import SwiftUI

/// View model for the share composer
@MainActor
class ShareComposerViewModel: ObservableObject {
    @Published var sharedContent: [SharedContent] = []
    @Published var selectedDestination: ShareDestination?
    @Published var additionalText: String = ""
    @Published var isLoading: Bool = true
    @Published var isSending: Bool = false
    @Published var error: String?
    @Published var destinations: [ShareDestination] = []
    @Published var recentDestinations: [ShareDestination] = []
    @Published var searchText: String = ""

    /// Check if user is signed in
    var isUserSignedIn: Bool {
        SharedUserIdentity.load() != nil
    }

    /// Current user's identity
    var userIdentity: SharedUserIdentity? {
        SharedUserIdentity.load()
    }

    /// Filtered destinations based on search
    var filteredDestinations: [ShareDestination] {
        if searchText.isEmpty {
            return destinations
        }
        return destinations.filter {
            $0.displayName.localizedCaseInsensitiveContains(searchText)
        }
    }

    /// Combined content preview
    var contentPreview: String {
        ContentExtractor.combineContents(sharedContent)
    }

    /// Load destinations from shared storage
    func loadDestinations() {
        // Load recent destinations
        recentDestinations = RecentDestinations.load()

        // Load all contacts and groups from shared storage
        loadContactsAndGroups()

        isLoading = false
    }

    /// Load contacts and groups from App Group shared storage
    private func loadContactsAndGroups() {
        guard let containerURL = ShareConfig.sharedContainerURL else {
            error = "Cannot access shared storage"
            return
        }

        let contactsURL = containerURL.appendingPathComponent("contacts.json")
        let groupsURL = containerURL.appendingPathComponent("groups.json")

        var allDestinations: [ShareDestination] = []

        // Load contacts
        if let contactsData = try? Data(contentsOf: contactsURL),
           let contactsDict = try? JSONDecoder().decode([String: ShareableContact].self, from: contactsData) {
            for (publicKey, contact) in contactsDict {
                let destination = ShareDestination.contact(
                    publicKey: publicKey,
                    name: contact.name,
                    avatarURL: contact.avatarURL
                )
                allDestinations.append(destination)
            }
        }

        // Load groups
        if let groupsData = try? Data(contentsOf: groupsURL),
           let groupsDict = try? JSONDecoder().decode([String: ShareableGroup].self, from: groupsData) {
            for (groupId, group) in groupsDict {
                let destination = ShareDestination.group(
                    id: groupId,
                    name: group.name,
                    avatarURL: group.avatarURL
                )
                allDestinations.append(destination)
            }
        }

        // Sort alphabetically
        destinations = allDestinations.sorted { $0.displayName < $1.displayName }
    }

    /// Queue the share for processing by main app
    func queueShare() async -> Bool {
        guard let destination = selectedDestination else {
            error = "Please select a destination"
            return false
        }

        isSending = true
        defer { isSending = false }

        do {
            // Create pending shares for each content item
            var pendingShares: [PendingShare] = []

            for content in sharedContent {
                let share = PendingShare(
                    destination: destination,
                    content: content,
                    additionalText: additionalText.isEmpty ? nil : additionalText
                )
                pendingShares.append(share)

                // Store image separately if present
                if let imageData = content.imageData {
                    try PendingShareQueue.shared.storeImage(for: share.id, imageData: imageData)
                }
            }

            // Enqueue all shares
            try PendingShareQueue.shared.enqueueAll(pendingShares)

            // Add to recent destinations
            RecentDestinations.add(destination)

            return true

        } catch {
            self.error = "Failed to queue share: \(error.localizedDescription)"
            return false
        }
    }
}

// MARK: - Share Composer View

/// Main composer view for Share Extension
struct ShareComposerView: View {
    @ObservedObject var viewModel: ShareComposerViewModel
    let onCancel: () -> Void
    let onComplete: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                if !viewModel.isUserSignedIn {
                    notSignedInView
                } else if viewModel.isLoading {
                    ProgressView("Loading...")
                        .padding()
                } else {
                    composerForm
                }
            }
            .navigationTitle("Share to BuildIt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        onCancel()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
                        Task {
                            if await viewModel.queueShare() {
                                onComplete()
                            }
                        }
                    }
                    .disabled(!canSend)
                }
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.error != nil },
                set: { if !$0 { viewModel.error = nil } }
            )) {
                Button("OK") {
                    viewModel.error = nil
                }
            } message: {
                Text(viewModel.error ?? "")
            }
        }
    }

    private var canSend: Bool {
        viewModel.selectedDestination != nil && !viewModel.isSending
    }

    // MARK: - Not Signed In View

    private var notSignedInView: some View {
        VStack(spacing: 20) {
            Image(systemName: "person.crop.circle.badge.exclamationmark")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("Not Signed In")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Please open BuildIt and sign in to share content.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button("Open BuildIt") {
                // This will just close the extension
                // User needs to manually open the app
                onCancel()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    // MARK: - Composer Form

    private var composerForm: some View {
        Form {
            // Content preview
            Section {
                contentPreviewSection
            } header: {
                Text("Sharing")
            }

            // Additional message
            Section {
                TextField("Add a message...", text: $viewModel.additionalText, axis: .vertical)
                    .lineLimit(3...6)
            } header: {
                Text("Message")
            }

            // Destination picker
            Section {
                destinationPicker
            } header: {
                Text("Send To")
            }
        }
        .overlay {
            if viewModel.isSending {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()

                ProgressView("Queuing...")
                    .padding()
                    .background(.regularMaterial)
                    .cornerRadius(12)
            }
        }
    }

    // MARK: - Content Preview

    @ViewBuilder
    private var contentPreviewSection: some View {
        ForEach(Array(viewModel.sharedContent.enumerated()), id: \.offset) { _, content in
            HStack(spacing: 12) {
                contentIcon(for: content.type)
                    .frame(width: 40, height: 40)
                    .background(Color.secondary.opacity(0.1))
                    .cornerRadius(8)

                VStack(alignment: .leading, spacing: 2) {
                    Text(contentTypeLabel(for: content.type))
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(content.previewText)
                        .font(.body)
                        .lineLimit(2)
                }
            }
        }
    }

    private func contentIcon(for type: SharedContentType) -> some View {
        Group {
            switch type {
            case .text:
                Image(systemName: "text.alignleft")
            case .url:
                Image(systemName: "link")
            case .image:
                Image(systemName: "photo")
            case .file:
                Image(systemName: "doc")
            }
        }
        .font(.title3)
        .foregroundColor(.accentColor)
    }

    private func contentTypeLabel(for type: SharedContentType) -> String {
        switch type {
        case .text: return "Text"
        case .url: return "Link"
        case .image: return "Image"
        case .file: return "File"
        }
    }

    // MARK: - Destination Picker

    private var destinationPicker: some View {
        Group {
            // Search field
            TextField("Search contacts & groups...", text: $viewModel.searchText)
                .textFieldStyle(.roundedBorder)

            // Selected destination
            if let destination = viewModel.selectedDestination {
                HStack {
                    destinationRow(destination)
                    Spacer()
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.accentColor)
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    viewModel.selectedDestination = nil
                }
            }

            // Recent destinations
            if !viewModel.recentDestinations.isEmpty && viewModel.searchText.isEmpty {
                Section {
                    ForEach(viewModel.recentDestinations) { destination in
                        destinationRow(destination)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                viewModel.selectedDestination = destination
                            }
                            .background(
                                viewModel.selectedDestination?.id == destination.id
                                    ? Color.accentColor.opacity(0.1)
                                    : Color.clear
                            )
                    }
                } header: {
                    Text("Recent")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // All destinations
            ForEach(viewModel.filteredDestinations) { destination in
                if viewModel.selectedDestination?.id != destination.id {
                    destinationRow(destination)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            viewModel.selectedDestination = destination
                        }
                }
            }

            if viewModel.filteredDestinations.isEmpty && !viewModel.searchText.isEmpty {
                Text("No matches found")
                    .foregroundColor(.secondary)
                    .italic()
            }
        }
    }

    private func destinationRow(_ destination: ShareDestination) -> some View {
        HStack(spacing: 12) {
            // Avatar
            destinationAvatar(destination)

            // Name and type
            VStack(alignment: .leading, spacing: 2) {
                Text(destination.displayName)
                    .font(.body)

                Text(destination.type == .contact ? "Contact" : "Group")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private func destinationAvatar(_ destination: ShareDestination) -> some View {
        Circle()
            .fill(destination.type == .contact ? Color.blue.opacity(0.2) : Color.purple.opacity(0.2))
            .frame(width: 40, height: 40)
            .overlay {
                Group {
                    if destination.type == .contact {
                        Text(destination.displayName.prefix(1).uppercased())
                            .foregroundColor(.blue)
                    } else {
                        Image(systemName: "person.3.fill")
                            .foregroundColor(.purple)
                    }
                }
                .font(.system(size: 16, weight: .semibold))
            }
    }
}

// MARK: - Preview

#if DEBUG
struct ShareComposerView_Previews: PreviewProvider {
    static var previews: some View {
        let viewModel = ShareComposerViewModel()
        viewModel.sharedContent = [
            SharedContent(
                type: .text,
                text: "This is some shared text content that might be a bit longer to show truncation.",
                url: nil,
                imageData: nil,
                fileName: nil,
                mimeType: nil
            ),
            SharedContent(
                type: .url,
                text: nil,
                url: "https://example.com/some/long/path",
                imageData: nil,
                fileName: nil,
                mimeType: nil
            )
        ]
        viewModel.isLoading = false
        viewModel.destinations = [
            .contact(publicKey: "abc123", name: "Alice"),
            .contact(publicKey: "def456", name: "Bob"),
            .group(id: "group1", name: "Test Group")
        ]

        return ShareComposerView(
            viewModel: viewModel,
            onCancel: {},
            onComplete: {}
        )
    }
}
#endif
