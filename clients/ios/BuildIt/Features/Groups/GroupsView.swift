// GroupsView.swift
// BuildIt - Decentralized Mesh Communication
//
// Group chat interface for managing and participating in group conversations.

import SwiftUI

/// Main groups view showing list of groups
struct GroupsView: View {
    @StateObject private var viewModel = GroupsViewModel()
    @State private var showCreateGroup = false
    @State private var selectedGroup: Group?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.groups.isEmpty {
                    EmptyGroupsView(showCreateGroup: $showCreateGroup)
                } else {
                    groupsList
                }
            }
            .navigationTitle("Groups")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showCreateGroup = true
                    } label: {
                        Image(systemName: "plus.circle")
                    }
                    .accessibilityLabel("Create group")
                    .accessibilityHint("Double tap to create a new group chat")
                }
            }
            .sheet(isPresented: $showCreateGroup) {
                CreateGroupView(viewModel: viewModel)
            }
            .navigationDestination(item: $selectedGroup) { group in
                GroupChatView(group: group, viewModel: viewModel)
            }
            .onAppear {
                viewModel.loadGroups()
            }
        }
    }

    private var groupsList: some View {
        List {
            ForEach(viewModel.groups) { group in
                GroupRow(group: group)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectedGroup = group
                    }
            }
            .onDelete { indexSet in
                viewModel.deleteGroups(at: indexSet)
            }
        }
        .listStyle(.plain)
        .refreshable {
            viewModel.loadGroups()
        }
    }
}

/// Empty state view when no groups exist
struct EmptyGroupsView: View {
    @Binding var showCreateGroup: Bool

    var body: some View {
        ContentUnavailableView {
            Label("No Groups", systemImage: "person.3")
        } description: {
            Text("Create a group to chat with multiple people at once.")
        } actions: {
            Button("Create Group") {
                showCreateGroup = true
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

/// Row view for a single group
struct GroupRow: View {
    let group: Group

    var body: some View {
        HStack(spacing: 12) {
            // Group avatar
            Circle()
                .fill(Color.purple.opacity(0.2))
                .frame(width: 50, height: 50)
                .overlay {
                    Image(systemName: "person.3.fill")
                        .foregroundColor(.purple)
                }
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(group.name)
                        .font(.headline)
                        .lineLimit(1)

                    Spacer()

                    if group.isPrivate {
                        Image(systemName: "lock.fill")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .accessibilityHidden(true)
                    }
                }

                Text("\(group.memberPublicKeys.count) members")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(group.name), \(group.isPrivate ? "private" : "public") group with \(group.memberPublicKeys.count) members")
        .accessibilityHint("Double tap to open group chat")
        .accessibilityAddTraits(.isButton)
    }
}

/// View for creating a new group
struct CreateGroupView: View {
    @ObservedObject var viewModel: GroupsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var groupName = ""
    @State private var groupDescription = ""
    @State private var isPrivate = true
    @State private var selectedMembers: Set<String> = []

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Group Name", text: $groupName)

                    TextField("Description (optional)", text: $groupDescription, axis: .vertical)
                        .lineLimit(3...6)

                    Toggle("Private Group", isOn: $isPrivate)
                } header: {
                    Text("Group Details")
                }

                Section {
                    ForEach(viewModel.contacts, id: \.publicKey) { contact in
                        HStack {
                            Text(contact.displayName)
                            Spacer()
                            if selectedMembers.contains(contact.publicKey) {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.blue)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            toggleMember(contact.publicKey)
                        }
                    }
                } header: {
                    Text("Add Members")
                } footer: {
                    Text("Select contacts to add to the group")
                }
            }
            .navigationTitle("Create Group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create") {
                        createGroup()
                    }
                    .disabled(groupName.isEmpty)
                }
            }
        }
    }

    private func toggleMember(_ publicKey: String) {
        if selectedMembers.contains(publicKey) {
            selectedMembers.remove(publicKey)
        } else {
            selectedMembers.insert(publicKey)
        }
    }

    private func createGroup() {
        Task {
            await viewModel.createGroup(
                name: groupName,
                description: groupDescription.isEmpty ? nil : groupDescription,
                isPrivate: isPrivate,
                members: Array(selectedMembers)
            )
            dismiss()
        }
    }
}

/// View for a group chat
struct GroupChatView: View {
    let group: Group
    @ObservedObject var viewModel: GroupsViewModel

    @State private var messageText = ""
    @State private var messages: [GroupMessage] = []
    @State private var showGroupInfo = false
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Messages list
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(messages) { message in
                            GroupMessageBubble(
                                message: message,
                                isFromMe: viewModel.isMessageFromMe(message)
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
                .accessibilityLabel("Send message")
                .accessibilityHint(messageText.isEmpty ? "Enter a message first" : "Double tap to send to group")
                .frame(minWidth: 44, minHeight: 44)
            }
            .padding()
            .background(Color(.systemBackground))
        }
        .navigationTitle(group.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showGroupInfo = true
                } label: {
                    Image(systemName: "info.circle")
                }
                .accessibilityLabel("Group info")
                .accessibilityHint("Double tap to view group details and members")
            }
        }
        .sheet(isPresented: $showGroupInfo) {
            GroupInfoView(group: group, viewModel: viewModel)
        }
        .onAppear {
            loadMessages()
        }
    }

    private func loadMessages() {
        messages = viewModel.getMessages(for: group.id)
    }

    private func sendMessage() {
        guard !messageText.isEmpty else { return }

        let text = messageText
        messageText = ""

        Task {
            await viewModel.sendGroupMessage(text, to: group)
            loadMessages()
        }
    }
}

/// Group message model
struct GroupMessage: Identifiable {
    let id: String
    let content: String
    let senderPublicKey: String
    let senderName: String?
    let timestamp: Date
}

/// Group message bubble view
struct GroupMessageBubble: View {
    let message: GroupMessage
    let isFromMe: Bool

    var body: some View {
        HStack {
            if isFromMe { Spacer() }

            VStack(alignment: isFromMe ? .trailing : .leading, spacing: 2) {
                if !isFromMe {
                    Text(message.senderName ?? message.senderPublicKey.prefix(8) + "...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Text(message.content)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(isFromMe ? Color.blue : Color(.systemGray5))
                    .foregroundColor(isFromMe ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                Text(message.timestamp.formatted(date: .omitted, time: .shortened))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            if !isFromMe { Spacer() }
        }
    }
}

/// Group info view
struct GroupInfoView: View {
    let group: Group
    @ObservedObject var viewModel: GroupsViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        Spacer()
                        Circle()
                            .fill(Color.purple.opacity(0.2))
                            .frame(width: 80, height: 80)
                            .overlay {
                                Image(systemName: "person.3.fill")
                                    .font(.largeTitle)
                                    .foregroundColor(.purple)
                            }
                        Spacer()
                    }

                    Text(group.name)
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .center)

                    if let description = group.description {
                        Text(description)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .listRowBackground(Color.clear)

                Section {
                    ForEach(group.memberPublicKeys, id: \.self) { publicKey in
                        HStack {
                            Circle()
                                .fill(Color.blue.opacity(0.2))
                                .frame(width: 40, height: 40)
                                .overlay {
                                    Text(viewModel.getMemberName(publicKey)?.prefix(1).uppercased() ?? "?")
                                        .foregroundColor(.blue)
                                }

                            VStack(alignment: .leading) {
                                Text(viewModel.getMemberName(publicKey) ?? publicKey.prefix(12) + "...")
                                    .font(.headline)

                                if group.adminPublicKeys.contains(publicKey) {
                                    Text("Admin")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                } header: {
                    Text("Members (\(group.memberPublicKeys.count))")
                }

                Section {
                    Button(role: .destructive) {
                        viewModel.leaveGroup(group)
                        dismiss()
                    } label: {
                        Label("Leave Group", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("Group Info")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    GroupsView()
}
