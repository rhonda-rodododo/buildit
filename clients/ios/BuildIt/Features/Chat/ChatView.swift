// ChatView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main chat interface showing conversations and messages.

import SwiftUI

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
            // Avatar
            Circle()
                .fill(Color.blue.opacity(0.2))
                .frame(width: 50, height: 50)
                .overlay {
                    Text(conversation.participantName?.prefix(1).uppercased() ?? "?")
                        .font(.title2)
                        .foregroundColor(.blue)
                }

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
                    }
                }
            }
        }
        .padding(.vertical, 4)
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

            Divider()

            // Input bar
            HStack(spacing: 12) {
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
    }

    private func loadMessages() {
        Task {
            messages = await MessageQueue.shared.getMessages(for: conversation.participantPublicKey)
        }
    }

    private func sendMessage() {
        guard !messageText.isEmpty else { return }

        let text = messageText
        messageText = ""

        Task {
            await viewModel.sendMessage(text, to: conversation.participantPublicKey)
            loadMessages()
        }
    }
}

/// QR Code scanner view placeholder
struct QRCodeScannerView: View {
    let onScan: (String) -> Void

    var body: some View {
        VStack {
            Text("QR Scanner")
                .font(.headline)

            Text("Camera access required")
                .foregroundColor(.secondary)

            // In production, this would use AVFoundation to scan QR codes
            Button("Simulate Scan") {
                onScan("npub1...")
            }
            .padding()
        }
    }
}

// MARK: - Preview

#Preview {
    ChatView()
}
