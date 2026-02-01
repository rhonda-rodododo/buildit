// ChatView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main chat interface showing conversations and messages.

import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// Main chat view showing list of conversations
struct ChatView: View {
    @StateObject private var viewModel = ChatViewModel()
    @State private var showNewChat = false
    @State private var selectedConversation: Conversation?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.conversations.isEmpty {
                    EmptyConversationsView(showNewChat: $showNewChat)
                } else {
                    conversationsList
                }
            }
            .navigationTitle("Messages")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showNewChat = true
                    } label: {
                        Image(systemName: "square.and.pencil")
                    }
                    .accessibilityLabel("New message")
                    .accessibilityHint("Double tap to start a new conversation")
                }
            }
            .sheet(isPresented: $showNewChat) {
                NewChatView(viewModel: viewModel)
            }
            .navigationDestination(item: $selectedConversation) { conversation in
                ConversationView(conversation: conversation, viewModel: viewModel)
            }
            .onAppear {
                viewModel.loadConversations()
            }
        }
    }

    private var conversationsList: some View {
        List {
            ForEach(viewModel.conversations) { conversation in
                ConversationRow(conversation: conversation)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectedConversation = conversation
                    }
            }
            .onDelete { indexSet in
                viewModel.deleteConversations(at: indexSet)
            }
        }
        .listStyle(.plain)
        .refreshable {
            await viewModel.refresh()
        }
    }
}

/// Empty state view when no conversations exist
struct EmptyConversationsView: View {
    @Binding var showNewChat: Bool

    var body: some View {
        ContentUnavailableView {
            Label("No Messages", systemImage: "message")
        } description: {
            Text("Start a conversation with someone nearby or via Nostr.")
        } actions: {
            Button("New Message") {
                showNewChat = true
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

/// Row view for a single conversation
struct ConversationRow: View {
    let conversation: Conversation

    var body: some View {
        HStack(spacing: 12) {
            // Avatar with caching
            CachedAvatarImage(
                url: conversation.participantAvatarURL,
                fallbackText: conversation.participantName ?? "?",
                size: 50
            )
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(conversation.participantName ?? conversation.participantPublicKey.prefix(12) + "...")
                        .font(.headline)
                        .lineLimit(1)

                    Spacer()

                    if let lastMessage = conversation.lastMessage {
                        Text(lastMessage.timestamp.formatted(.relative(presentation: .named)))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                HStack {
                    if let lastMessage = conversation.lastMessage {
                        Text(lastMessage.content)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }

                    Spacer()

                    if conversation.unreadCount > 0 {
                        Text("\(conversation.unreadCount)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(Color.blue)
                            .clipShape(Capsule())
                            .accessibilityHidden(true)
                    }
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(conversationAccessibilityLabel)
        .accessibilityHint("Double tap to open conversation")
        .accessibilityAddTraits(.isButton)
    }

    private var conversationAccessibilityLabel: String {
        var label = "Conversation with \(conversation.participantName ?? "Unknown")"

        if conversation.unreadCount > 0 {
            label += ". \(conversation.unreadCount) unread \(conversation.unreadCount == 1 ? "message" : "messages")"
        }

        if let lastMessage = conversation.lastMessage {
            let truncated = lastMessage.content.count > 50
                ? String(lastMessage.content.prefix(50)) + "..."
                : lastMessage.content
            label += ". Last message: \(truncated)"
            label += ". \(lastMessage.timestamp.formatted(.relative(presentation: .named)))"
        }

        return label
    }
}

/// View for creating a new chat
struct NewChatView: View {
    @ObservedObject var viewModel: ChatViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var publicKey = ""
    @State private var showScanner = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Public Key or npub", text: $publicKey)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()

                    Button {
                        showScanner = true
                    } label: {
                        Label("Scan QR Code", systemImage: "qrcode.viewfinder")
                    }
                } header: {
                    Text("Enter Recipient")
                }

                Section {
                    ForEach(viewModel.nearbyPeers, id: \.id) { peer in
                        Button {
                            publicKey = peer.publicKey
                        } label: {
                            HStack {
                                Circle()
                                    .fill(Color.green)
                                    .frame(width: 8, height: 8)
                                Text(peer.publicKey.prefix(16) + "...")
                                Spacer()
                                Text("\(peer.rssi ?? 0) dBm")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .foregroundColor(.primary)
                    }
                } header: {
                    Text("Nearby Devices")
                }
            }
            .navigationTitle("New Message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Start") {
                        viewModel.startConversation(with: publicKey)
                        dismiss()
                    }
                    .disabled(publicKey.isEmpty)
                }
            }
            .sheet(isPresented: $showScanner) {
                QRCodeScannerView { scannedCode in
                    publicKey = scannedCode
                    showScanner = false
                }
            }
        }
    }
}

/// View for a single conversation
struct ConversationView: View {
    let conversation: Conversation
    @ObservedObject var viewModel: ChatViewModel

    @State private var messageText = ""
    @State private var messages: [QueuedMessage] = []
    @FocusState private var isInputFocused: Bool
    @StateObject private var linkDetector = LinkPreviewDetector()

    var body: some View {
        VStack(spacing: 0) {
            // Messages list
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(messages) { message in
                            MessageBubble(
                                message: message,
                                isFromMe: message.senderPublicKey != conversation.participantPublicKey
                            )
                            .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: messages.count) { _, _ in
                    if let lastMessage = messages.last {
                        withAnimation {
                            proxy.scrollTo(lastMessage.id, anchor: .bottom)
                        }
                    }
                }
            }

            // Link previews above input
            if !linkDetector.previews.isEmpty || linkDetector.isLoading {
                LinkPreviewStrip(
                    previews: linkDetector.previews,
                    isLoading: linkDetector.isLoading,
                    onRemove: { url in linkDetector.removePreview(url: url) }
                )
                .padding(.vertical, 4)
            }

            Divider()

            // Input bar
            HStack(spacing: 12) {
                // Attachment button
                AttachmentButton { attachments in
                    handleAttachments(attachments)
                }

                TextField("Message", text: $messageText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .focused($isInputFocused)

                Button {
                    sendMessage()
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title)
                        .foregroundColor(messageText.isEmpty ? .gray : .blue)
                }
                .disabled(messageText.isEmpty)
                .accessibilityLabel("Send message")
                .accessibilityHint(messageText.isEmpty ? "Enter a message first" : "Double tap to send")
                .frame(minWidth: 44, minHeight: 44)
            }
            .padding()
            .background(Color(.systemBackground))
        }
        .navigationTitle(conversation.participantName ?? "Chat")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        // Show contact info
                    } label: {
                        Label("View Profile", systemImage: "person.circle")
                    }

                    Button(role: .destructive) {
                        // Clear chat
                    } label: {
                        Label("Clear Chat", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .onAppear {
            loadMessages()
            viewModel.markAsRead(conversation: conversation)
        }
        .onChange(of: messageText) { _, newValue in
            linkDetector.textDidChange(newValue)
        }
    }

    private func loadMessages() {
        Task {
            messages = await MessageQueue.shared.getMessages(for: conversation.participantPublicKey)
        }
    }

    private func sendMessage() {
        guard !messageText.isEmpty else { return }

        let text = messageText
        let previews = linkDetector.previews
        messageText = ""
        linkDetector.clearPreviews()

        Task {
            await viewModel.sendMessage(text, to: conversation.participantPublicKey, linkPreviews: previews)
            loadMessages()
        }
    }

    private func handleAttachments(_ attachments: [AttachmentData]) {
        for attachment in attachments {
            Task {
                await viewModel.sendAttachment(attachment, to: conversation.participantPublicKey)
                loadMessages()
            }
        }
    }
}

/// Attachment button with menu for photos, files, etc.
struct AttachmentButton: View {
    let onAttach: ([AttachmentData]) -> Void

    @State private var showPhotoPicker = false
    @State private var showFilePicker = false

    var body: some View {
        Menu {
            Button {
                showPhotoPicker = true
            } label: {
                Label("Photo & Video", systemImage: "photo")
            }

            Button {
                showFilePicker = true
            } label: {
                Label("Document", systemImage: "doc")
            }
        } label: {
            Image(systemName: "plus.circle.fill")
                .font(.title2)
                .foregroundColor(.blue)
        }
        .accessibilityLabel("Attach file")
        .accessibilityHint("Double tap to choose photo, video, or document")
        .frame(minWidth: 44, minHeight: 44)
        .photosPicker(
            isPresented: $showPhotoPicker,
            selection: .constant([]),
            matching: .any(of: [.images, .videos])
        )
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.item],
            allowsMultipleSelection: true
        ) { result in
            switch result {
            case .success(let urls):
                let attachments = urls.compactMap { url -> AttachmentData? in
                    guard url.startAccessingSecurityScopedResource() else { return nil }
                    defer { url.stopAccessingSecurityScopedResource() }

                    guard let data = try? Data(contentsOf: url) else { return nil }
                    return AttachmentData(
                        fileName: url.lastPathComponent,
                        mimeType: url.mimeType,
                        data: data
                    )
                }
                onAttach(attachments)
            case .failure:
                break
            }
        }
    }
}

/// Attachment data model
struct AttachmentData {
    let fileName: String
    let mimeType: String
    let data: Data

    var isImage: Bool {
        mimeType.hasPrefix("image/")
    }

    var isVideo: Bool {
        mimeType.hasPrefix("video/")
    }
}

/// URL extension for MIME type
extension URL {
    var mimeType: String {
        let pathExtension = self.pathExtension.lowercased()
        switch pathExtension {
        case "jpg", "jpeg": return "image/jpeg"
        case "png": return "image/png"
        case "gif": return "image/gif"
        case "heic": return "image/heic"
        case "mp4": return "video/mp4"
        case "mov": return "video/quicktime"
        case "pdf": return "application/pdf"
        case "doc", "docx": return "application/msword"
        case "txt": return "text/plain"
        default: return "application/octet-stream"
        }
    }
}

// MARK: - Preview

#Preview {
    ChatView()
}
