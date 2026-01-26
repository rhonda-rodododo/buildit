// ContactTagsView.swift
// BuildIt - Decentralized Mesh Communication
//
// Views for managing contact tags.

import SwiftUI

/// View for managing tags assigned to a contact.
struct ContactTagsView: View {
    let contactPubkey: String
    let service: ContactNotesService

    @State private var assignedTags: [ContactTag] = []
    @State private var allTags: [ContactTag] = []
    @State private var showCreateTag = false

    var body: some View {
        List {
            Section {
                ForEach(allTags) { tag in
                    TagSelectionRow(
                        tag: tag,
                        isSelected: assignedTags.contains { $0.id == tag.id },
                        onToggle: { toggleTag(tag) }
                    )
                }
            } header: {
                Text("Assigned Tags")
            } footer: {
                Text("Tap to assign or remove tags from this contact.")
            }

            Section {
                Button(action: { showCreateTag = true }) {
                    Label("Create New Tag", systemImage: "plus.circle")
                }
            }
        }
        .navigationTitle("Tags")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showCreateTag) {
            TagEditorView(service: service) { newTag in
                allTags.append(newTag)
                allTags.sort { $0.name < $1.name }
            }
        }
        .task {
            loadTags()
        }
    }

    private func loadTags() {
        allTags = service.getAllTags()
        assignedTags = service.getTags(for: contactPubkey)
    }

    private func toggleTag(_ tag: ContactTag) {
        do {
            if assignedTags.contains(where: { $0.id == tag.id }) {
                try service.removeTag(tag, from: contactPubkey)
                assignedTags.removeAll { $0.id == tag.id }
            } else {
                try service.assignTag(tag, to: contactPubkey)
                assignedTags.append(tag)
            }
        } catch {
            print("Error toggling tag: \(error)")
        }
    }
}

// MARK: - Tag Selection Row

struct TagSelectionRow: View {
    let tag: ContactTag
    let isSelected: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack {
                Circle()
                    .fill(Color(hex: tag.color) ?? .blue)
                    .frame(width: 12, height: 12)

                Text(tag.name)
                    .foregroundColor(.primary)

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark")
                        .foregroundColor(.accentColor)
                }
            }
        }
    }
}

// MARK: - Tag Editor

struct TagEditorView: View {
    let service: ContactNotesService
    var existingTag: ContactTag?
    let onSave: (ContactTag) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var selectedColor: String = "#3B82F6"
    @State private var error: String?

    private let colorOptions = [
        "#EF4444", "#F59E0B", "#10B981", "#3B82F6",
        "#8B5CF6", "#EC4899", "#06B6D4", "#14B8A6",
        "#6B7280", "#DC2626", "#D97706", "#059669"
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Tag Name", text: $name)
                } header: {
                    Text("Name")
                }

                Section {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: 12) {
                        ForEach(colorOptions, id: \.self) { color in
                            ColorPickerButton(
                                color: color,
                                isSelected: selectedColor == color,
                                onSelect: { selectedColor = color }
                            )
                        }
                    }
                    .padding(.vertical, 8)
                } header: {
                    Text("Color")
                }

                Section {
                    HStack {
                        Circle()
                            .fill(Color(hex: selectedColor) ?? .blue)
                            .frame(width: 12, height: 12)
                        Text(name.isEmpty ? "Tag Preview" : name)
                            .foregroundColor(name.isEmpty ? .secondary : .primary)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(.systemGray6))
                    .clipShape(Capsule())
                } header: {
                    Text("Preview")
                }

                if let error = error {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle(existingTag != nil ? "Edit Tag" : "New Tag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveTag() }
                        .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear {
                if let tag = existingTag {
                    name = tag.name
                    selectedColor = tag.color
                }
            }
        }
    }

    private func saveTag() {
        do {
            let savedTag: ContactTag
            if let existing = existingTag {
                savedTag = try service.updateTag(existing, name: name.trimmingCharacters(in: .whitespacesAndNewlines), color: selectedColor)
            } else {
                savedTag = try service.createTag(name: name.trimmingCharacters(in: .whitespacesAndNewlines), color: selectedColor)
            }
            onSave(savedTag)
            dismiss()
        } catch {
            self.error = "Failed to save tag: \(error.localizedDescription)"
        }
    }
}

// MARK: - Color Picker Button

struct ColorPickerButton: View {
    let color: String
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            ZStack {
                Circle()
                    .fill(Color(hex: color) ?? .blue)
                    .frame(width: 36, height: 36)

                if isSelected {
                    Circle()
                        .strokeBorder(Color.white, lineWidth: 2)
                        .frame(width: 36, height: 36)

                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                }
            }
        }
    }
}

// MARK: - Tag Manager View

struct TagManagerView: View {
    let service: ContactNotesService
    @State private var tags: [ContactTag] = []
    @State private var showCreateTag = false
    @State private var editingTag: ContactTag?

    var body: some View {
        List {
            if tags.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "tag")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)

                    Text("No tags yet")
                        .font(.headline)

                    Text("Create tags to organize your contacts.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)

                    Button(action: { showCreateTag = true }) {
                        Label("Create Tag", systemImage: "plus")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding()
            } else {
                ForEach(tags) { tag in
                    HStack {
                        Circle()
                            .fill(Color(hex: tag.color) ?? .blue)
                            .frame(width: 12, height: 12)

                        Text(tag.name)

                        Spacer()

                        let count = service.getContactsWithTag(tag).count
                        Text("\(count)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        editingTag = tag
                    }
                }
                .onDelete(perform: deleteTags)
            }
        }
        .navigationTitle("Manage Tags")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showCreateTag = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showCreateTag) {
            TagEditorView(service: service) { newTag in
                tags.append(newTag)
                tags.sort { $0.name < $1.name }
            }
        }
        .sheet(item: $editingTag) { tag in
            TagEditorView(service: service, existingTag: tag) { updatedTag in
                if let index = tags.firstIndex(where: { $0.id == updatedTag.id }) {
                    tags[index] = updatedTag
                }
            }
        }
        .task {
            loadTags()
        }
    }

    private func loadTags() {
        tags = service.getAllTags()
    }

    private func deleteTags(at offsets: IndexSet) {
        for index in offsets {
            let tag = tags[index]
            do {
                try service.deleteTag(tag)
                tags.remove(at: index)
            } catch {
                print("Error deleting tag: \(error)")
            }
        }
    }
}

// MARK: - Tag Chips View

struct TagChipsView: View {
    let tags: [ContactTag]
    var onTagTap: ((ContactTag) -> Void)?

    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(tags) { tag in
                TagChip(tag: tag)
                    .onTapGesture {
                        onTagTap?(tag)
                    }
            }
        }
    }
}

struct TagChip: View {
    let tag: ContactTag

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(Color(hex: tag.color) ?? .blue)
                .frame(width: 8, height: 8)

            Text(tag.name)
                .font(.caption)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color(.systemGray6))
        .clipShape(Capsule())
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, subviews: subviews, spacing: spacing)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.positions[index].x,
                                       y: bounds.minY + result.positions[index].y),
                          proposal: .unspecified)
        }
    }

    struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []

        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var lineHeight: CGFloat = 0

            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)

                if x + size.width > maxWidth, x > 0 {
                    x = 0
                    y += lineHeight + spacing
                    lineHeight = 0
                }

                positions.append(CGPoint(x: x, y: y))
                lineHeight = max(lineHeight, size.height)
                x += size.width + spacing
            }

            size = CGSize(width: maxWidth, height: y + lineHeight)
        }
    }
}

// MARK: - Color Extension

extension Color {
    init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

        let r = Double((rgb & 0xFF0000) >> 16) / 255.0
        let g = Double((rgb & 0x00FF00) >> 8) / 255.0
        let b = Double(rgb & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b)
    }
}
