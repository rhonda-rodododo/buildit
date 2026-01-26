// ContactNotesView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for displaying and managing contact notes.

import SwiftUI

/// View for managing notes for a specific contact.
struct ContactNotesView: View {
    let contactPubkey: String
    let contactDisplayName: String?
    let service: ContactNotesService

    @State private var notes: [ContactNote] = []
    @State private var showAddNote = false
    @State private var editingNote: ContactNote?

    var body: some View {
        List {
            if notes.isEmpty {
                emptyStateView
            } else {
                ForEach(notes) { note in
                    NoteRow(note: note)
                        .onTapGesture {
                            editingNote = note
                        }
                }
                .onDelete(perform: deleteNotes)
            }
        }
        .navigationTitle("Notes")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showAddNote = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddNote) {
            NoteEditorView(
                contactPubkey: contactPubkey,
                service: service
            ) { newNote in
                notes.insert(newNote, at: 0)
            }
        }
        .sheet(item: $editingNote) { note in
            NoteEditorView(
                contactPubkey: contactPubkey,
                service: service,
                existingNote: note
            ) { updatedNote in
                if let index = notes.firstIndex(where: { $0.id == updatedNote.id }) {
                    notes[index] = updatedNote
                }
            }
        }
        .task {
            loadNotes()
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "note.text")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No notes yet")
                .font(.headline)

            Text("Add notes to track conversations, follow-ups, and important details about \(contactDisplayName ?? "this contact").")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button(action: { showAddNote = true }) {
                Label("Add Note", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private func loadNotes() {
        notes = service.getNotes(for: contactPubkey)
    }

    private func deleteNotes(at offsets: IndexSet) {
        for index in offsets {
            let note = notes[index]
            do {
                try service.deleteNote(note)
                notes.remove(at: index)
            } catch {
                print("Error deleting note: \(error)")
            }
        }
    }
}

// MARK: - Note Row

struct NoteRow: View {
    let note: ContactNote

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(note.category.displayName, systemImage: note.category.icon)
                    .font(.caption)
                    .foregroundColor(.accentColor)

                Spacer()

                Text(formatDate(note.updatedAt ?? note.createdAt))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Text(note.content)
                .font(.body)
                .lineLimit(3)
        }
        .padding(.vertical, 4)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Note Editor

struct NoteEditorView: View {
    let contactPubkey: String
    let service: ContactNotesService
    var existingNote: ContactNote?
    let onSave: (ContactNote) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var content: String = ""
    @State private var category: NoteCategory = .general
    @State private var isSaving = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextEditor(text: $content)
                        .frame(minHeight: 150)
                } header: {
                    Text("Note")
                }

                Section {
                    Picker("Category", selection: $category) {
                        ForEach(NoteCategory.allCases, id: \.self) { cat in
                            Label(cat.displayName, systemImage: cat.icon)
                                .tag(cat)
                        }
                    }
                } header: {
                    Text("Category")
                }

                if let error = error {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle(existingNote != nil ? "Edit Note" : "New Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveNote() }
                        .disabled(content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
            .onAppear {
                if let note = existingNote {
                    content = note.content
                    category = note.category
                }
            }
        }
    }

    private func saveNote() {
        isSaving = true
        error = nil

        do {
            let savedNote: ContactNote
            if let existing = existingNote {
                savedNote = try service.updateNote(existing, content: content.trimmingCharacters(in: .whitespacesAndNewlines), category: category)
            } else {
                savedNote = try service.createNote(for: contactPubkey, content: content.trimmingCharacters(in: .whitespacesAndNewlines), category: category)
            }
            onSave(savedNote)
            dismiss()
        } catch {
            self.error = "Failed to save note: \(error.localizedDescription)"
            isSaving = false
        }
    }
}

// MARK: - Follow Up Notes View

struct FollowUpNotesView: View {
    let service: ContactNotesService
    @State private var notes: [ContactNote] = []

    var body: some View {
        List {
            if notes.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 48))
                        .foregroundColor(.green)

                    Text("No pending follow-ups")
                        .font(.headline)

                    Text("Mark notes as 'Follow Up' to track pending actions.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
            } else {
                ForEach(notes) { note in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(note.contactPubkey.prefix(16) + "...")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text(note.content)
                            .font(.body)
                            .lineLimit(2)

                        Text(formatDate(note.createdAt))
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Follow Ups")
        .task {
            notes = service.getFollowUpNotes()
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}
