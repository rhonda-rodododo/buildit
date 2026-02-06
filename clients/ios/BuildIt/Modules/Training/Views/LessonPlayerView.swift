// LessonPlayerView.swift
// BuildIt - Decentralized Mesh Communication
//
// Lesson content player for videos, documents, quizzes, and more.

import SwiftUI
import AVKit
import PDFKit

/// Lesson player view
public struct LessonPlayerView: View {
    let lesson: LessonEntity
    @ObservedObject var store: TrainingStore
    let manager: TrainingManager

    @Environment(\.dismiss) private var dismiss
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var lessonProgress: LessonProgress?
    @State private var showQuiz = false
    @State private var siblingLessons: [LessonEntity] = []
    @State private var showCourseComplete = false

    public init(lesson: LessonEntity, store: TrainingStore, manager: TrainingManager) {
        self.lesson = lesson
        self.store = store
        self.manager = manager
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Content area
                contentView
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                // Progress bar and controls
                controlsBar
            }
            .navigationTitle(lesson.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            try await markComplete()
                        }
                    } label: {
                        Label("Mark Complete", systemImage: "checkmark.circle")
                    }
                }
            }
            .task {
                await loadData()
            }
            .sheet(isPresented: $showQuiz) {
                if let lessonData = lesson.toLesson(),
                   case .quiz(let quizContent) = lessonData.content {
                    QuizView(
                        lesson: lessonData,
                        quizContent: quizContent,
                        manager: manager,
                        onComplete: { passed, score in
                            showQuiz = false
                            if passed {
                                Task {
                                    try await manager.completeLesson(lesson.id, score: score)
                                    await loadData()
                                }
                            }
                        }
                    )
                }
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: {
                if let error = errorMessage {
                    Text(error)
                }
            }
        }
    }

    @ViewBuilder
    private var contentView: some View {
        if isLoading {
            ProgressView()
        } else if let lessonData = lesson.toLesson() {
            switch lessonData.content {
            case .video(let videoContent):
                VideoLessonView(content: videoContent)

            case .document(let documentContent):
                DocumentLessonView(content: documentContent)

            case .quiz:
                QuizStartView(
                    lesson: lessonData,
                    onStart: { showQuiz = true }
                )

            case .liveSession(let liveContent):
                LiveSessionLessonView(content: liveContent)
            }
        } else {
            ContentUnavailableView(
                "Content Unavailable",
                systemImage: "exclamationmark.triangle",
                description: Text("Unable to load lesson content.")
            )
        }
    }

    /// Index of the current lesson within the sibling lesson list
    private var currentLessonIndex: Int? {
        siblingLessons.firstIndex(where: { $0.id == lesson.id })
    }

    /// Whether there is a previous lesson available
    private var hasPreviousLesson: Bool {
        guard let index = currentLessonIndex else { return false }
        return index > 0
    }

    /// Whether there is a next lesson available
    private var hasNextLesson: Bool {
        guard let index = currentLessonIndex else { return false }
        return index < siblingLessons.count - 1
    }

    private var controlsBar: some View {
        VStack(spacing: 12) {
            // Progress indicator
            if let progress = lessonProgress {
                HStack {
                    Text("Progress: \(progress.status.rawValue.capitalized)")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer()

                    if progress.status == .completed {
                        Label("Completed", systemImage: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                }
            }

            // Navigation buttons
            HStack(spacing: 16) {
                Button {
                    navigateToPreviousLesson()
                } label: {
                    Label("Previous", systemImage: "chevron.left")
                }
                .disabled(!hasPreviousLesson)

                Spacer()

                Button {
                    navigateToNextLesson()
                } label: {
                    Label("Next", systemImage: "chevron.right")
                }
                .disabled(!hasNextLesson && showCourseComplete)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: -2)
        .alert("Course Complete", isPresented: $showCourseComplete) {
            Button("Done") {
                dismiss()
            }
        } message: {
            Text("Congratulations! You have completed all lessons in this module.")
        }
    }

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }

        do {
            // Start lesson if not already started
            try await manager.startLesson(lesson.id)

            // Load progress
            if let progressEntity = store.lessonProgress[lesson.id] {
                lessonProgress = progressEntity.toProgress()
            }

            // Load sibling lessons for navigation (sorted by order)
            if siblingLessons.isEmpty {
                siblingLessons = (try? store.getLessons(moduleId: lesson.moduleId)) ?? []
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func markComplete() async throws {
        try await manager.completeLesson(lesson.id)
        await loadData()
    }

    /// Navigate to the previous lesson in the module
    private func navigateToPreviousLesson() {
        guard let index = currentLessonIndex, index > 0 else { return }
        let previousLesson = siblingLessons[index - 1]
        store.setCurrentLesson(previousLesson)
    }

    /// Navigate to the next lesson in the module, marking the current one complete
    private func navigateToNextLesson() {
        guard let index = currentLessonIndex else { return }

        // Mark the current lesson as completed
        Task {
            try? await manager.completeLesson(lesson.id)
        }

        // Check if this is the last lesson
        if index >= siblingLessons.count - 1 {
            showCourseComplete = true
            return
        }

        let nextLesson = siblingLessons[index + 1]
        store.setCurrentLesson(nextLesson)
    }
}

// MARK: - Video Lesson View

struct VideoLessonView: View {
    let content: VideoContent

    var body: some View {
        VStack {
            if let url = URL(string: content.videoUrl) {
                VideoPlayer(player: AVPlayer(url: url))
            } else {
                ContentUnavailableView(
                    "Video Unavailable",
                    systemImage: "play.slash",
                    description: Text("Unable to load video content.")
                )
            }
        }
    }
}

// MARK: - Document Lesson View

struct DocumentLessonView: View {
    let content: DocumentContent

    var body: some View {
        if let markdown = content.markdown {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(markdown)
                        .font(.body)
                }
                .padding()
            }
        } else if let pdfUrl = content.pdfUrl {
            PDFDocumentView(urlString: pdfUrl)
        } else {
            ContentUnavailableView(
                "No Content",
                systemImage: "doc.text",
                description: Text("This document has no content.")
            )
        }
    }
}

// MARK: - PDF Document View

/// UIViewRepresentable wrapper for PDFKit's PDFView
struct PDFDocumentView: UIViewRepresentable {
    let urlString: String

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical

        // Load the PDF document
        if let url = URL(string: urlString) {
            Task { @MainActor in
                if url.isFileURL {
                    pdfView.document = PDFDocument(url: url)
                } else {
                    // Download remote PDFs
                    do {
                        let (data, _) = try await URLSession.shared.data(from: url)
                        pdfView.document = PDFDocument(data: data)
                    } catch {
                        // The PDFView will remain empty, showing nothing
                    }
                }
            }
        }

        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {
        // No update needed - the document is loaded once in makeUIView
    }
}

// MARK: - Quiz Start View

struct QuizStartView: View {
    let lesson: Lesson
    let onStart: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 60))
                .foregroundColor(.accentColor)

            Text("Quiz")
                .font(.title)
                .fontWeight(.bold)

            if case .quiz(let quizContent) = lesson.content {
                VStack(spacing: 12) {
                    InfoRow(
                        icon: "questionmark.circle",
                        title: "Questions",
                        value: "\(quizContent.questions.count)"
                    )

                    InfoRow(
                        icon: "target",
                        title: "Passing Score",
                        value: "\(quizContent.passingScore)%"
                    )

                    if let timeLimit = quizContent.timeLimitMinutes {
                        InfoRow(
                            icon: "clock",
                            title: "Time Limit",
                            value: "\(timeLimit) minutes"
                        )
                    }

                    if quizContent.allowRetakes {
                        InfoRow(
                            icon: "arrow.counterclockwise",
                            title: "Retakes",
                            value: quizContent.maxAttempts.map { "\($0) max" } ?? "Unlimited"
                        )
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(12)
            }

            Button {
                onStart()
            } label: {
                HStack {
                    Image(systemName: "play.fill")
                    Text("Start Quiz")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding()
    }
}

struct InfoRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .frame(width: 24)
                .foregroundColor(.secondary)
            Text(title)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Live Session Lesson View

struct LiveSessionLessonView: View {
    let content: LiveSessionContent

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "video")
                .font(.system(size: 60))
                .foregroundColor(.accentColor)

            Text("Live Session")
                .font(.title)
                .fontWeight(.bold)

            VStack(spacing: 12) {
                InfoRow(
                    icon: "calendar",
                    title: "Scheduled",
                    value: content.scheduledAt.formatted(date: .abbreviated, time: .shortened)
                )

                InfoRow(
                    icon: "clock",
                    title: "Duration",
                    value: "\(content.duration) minutes"
                )

                if let maxParticipants = content.maxParticipants {
                    InfoRow(
                        icon: "person.3",
                        title: "Max Participants",
                        value: "\(maxParticipants)"
                    )
                }
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)

            if content.scheduledAt > Date() {
                // Session hasn't started yet
                VStack(spacing: 8) {
                    Text("Session starts in:")
                        .foregroundColor(.secondary)
                    Text(content.scheduledAt, style: .relative)
                        .font(.title3)
                        .fontWeight(.semibold)
                }
            } else if let conferenceRoomId = content.conferenceRoomId {
                Button {
                    // Join conference
                } label: {
                    HStack {
                        Image(systemName: "video.fill")
                        Text("Join Session")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }

            if let recordingUrl = content.recordingUrl {
                Button {
                    // Watch recording
                } label: {
                    HStack {
                        Image(systemName: "play.rectangle")
                        Text("Watch Recording")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
    }
}

// MARK: - Preview

#Preview {
    let store = try! TrainingStore()
    let manager = TrainingManager(store: store)

    let lesson = LessonEntity(
        id: "test",
        moduleId: "mod1",
        type: "document",
        title: "Introduction to OpSec",
        contentJSON: try! JSONEncoder().encode(
            LessonContent.document(DocumentContent(markdown: "# Introduction\n\nThis is a test lesson about operational security."))
        ),
        order: 1,
        estimatedMinutes: 10
    )

    return LessonPlayerView(lesson: lesson, store: store, manager: manager)
}
