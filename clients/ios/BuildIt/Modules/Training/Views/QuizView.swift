// QuizView.swift
// BuildIt - Decentralized Mesh Communication
//
// Quiz component for taking quizzes within training lessons.

import SwiftUI

/// Quiz view for answering questions
public struct QuizView: View {
    let lesson: Lesson
    let quizContent: QuizContent
    let manager: TrainingManager
    let onComplete: (Bool, Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var currentQuestionIndex = 0
    @State private var selectedAnswers: [String: [String]] = [:]
    @State private var isSubmitting = false
    @State private var showResults = false
    @State private var quizResult: QuizResult?
    @State private var timeRemaining: Int?
    @State private var timer: Timer?

    private var questions: [QuizQuestion] {
        quizContent.shuffleQuestions
            ? quizContent.questions.shuffled()
            : quizContent.questions.sorted { $0.order < $1.order }
    }

    private var currentQuestion: QuizQuestion {
        questions[currentQuestionIndex]
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Progress header
                progressHeader

                Divider()

                if showResults, let result = quizResult {
                    // Results view
                    QuizResultsView(
                        result: result,
                        quizContent: quizContent,
                        onRetry: {
                            resetQuiz()
                        },
                        onDone: {
                            onComplete(result.passed, result.score)
                        }
                    )
                } else {
                    // Question view
                    questionView
                }
            }
            .navigationTitle("Quiz")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                if let remaining = timeRemaining {
                    ToolbarItem(placement: .topBarTrailing) {
                        Label(formatTime(remaining), systemImage: "clock")
                            .foregroundColor(remaining < 60 ? .red : .secondary)
                    }
                }
            }
            .onAppear {
                startTimer()
            }
            .onDisappear {
                timer?.invalidate()
            }
        }
    }

    private var progressHeader: some View {
        VStack(spacing: 8) {
            // Question counter
            Text("Question \(currentQuestionIndex + 1) of \(questions.count)")
                .font(.caption)
                .foregroundColor(.secondary)

            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(.systemGray5))
                        .frame(height: 6)

                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.accentColor)
                        .frame(
                            width: geometry.size.width * CGFloat(currentQuestionIndex + 1) / CGFloat(questions.count),
                            height: 6
                        )
                }
            }
            .frame(height: 6)
        }
        .padding()
    }

    private var questionView: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Question text
                    Text(currentQuestion.question)
                        .font(.title3)
                        .fontWeight(.medium)

                    // Answer options
                    answerOptions
                }
                .padding()
            }

            Divider()

            // Navigation buttons
            navigationButtons
        }
    }

    @ViewBuilder
    private var answerOptions: some View {
        VStack(spacing: 12) {
            switch currentQuestion.type {
            case .multipleChoice, .trueFalse:
                singleSelectOptions

            case .multiSelect:
                multiSelectOptions

            case .fillInBlank, .shortAnswer:
                textInputOption
            }
        }
    }

    private var singleSelectOptions: some View {
        ForEach(currentQuestion.options ?? [], id: \.self) { option in
            let isSelected = selectedAnswers[currentQuestion.id]?.contains(option) ?? false

            Button {
                selectedAnswers[currentQuestion.id] = [option]
            } label: {
                HStack {
                    Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                        .foregroundColor(isSelected ? .accentColor : .secondary)

                    Text(option)
                        .foregroundColor(.primary)
                        .multilineTextAlignment(.leading)

                    Spacer()
                }
                .padding()
                .background(isSelected ? Color.accentColor.opacity(0.1) : Color(.systemGray6))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 2)
                )
            }
        }
    }

    private var multiSelectOptions: some View {
        ForEach(currentQuestion.options ?? [], id: \.self) { option in
            let isSelected = selectedAnswers[currentQuestion.id]?.contains(option) ?? false

            Button {
                var current = selectedAnswers[currentQuestion.id] ?? []
                if isSelected {
                    current.removeAll { $0 == option }
                } else {
                    current.append(option)
                }
                selectedAnswers[currentQuestion.id] = current
            } label: {
                HStack {
                    Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                        .foregroundColor(isSelected ? .accentColor : .secondary)

                    Text(option)
                        .foregroundColor(.primary)
                        .multilineTextAlignment(.leading)

                    Spacer()
                }
                .padding()
                .background(isSelected ? Color.accentColor.opacity(0.1) : Color(.systemGray6))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 2)
                )
            }
        }
    }

    @State private var textAnswer = ""

    private var textInputOption: some View {
        TextField("Your answer", text: $textAnswer)
            .textFieldStyle(.roundedBorder)
            .onChange(of: textAnswer) { _, newValue in
                selectedAnswers[currentQuestion.id] = [newValue]
            }
    }

    private var navigationButtons: some View {
        HStack(spacing: 16) {
            // Previous button
            Button {
                withAnimation {
                    currentQuestionIndex -= 1
                }
            } label: {
                Label("Previous", systemImage: "chevron.left")
            }
            .disabled(currentQuestionIndex == 0)

            Spacer()

            // Next/Submit button
            if currentQuestionIndex == questions.count - 1 {
                Button {
                    submitQuiz()
                } label: {
                    HStack {
                        if isSubmitting {
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                        Text("Submit")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSubmitting)
            } else {
                Button {
                    withAnimation {
                        currentQuestionIndex += 1
                    }
                } label: {
                    Label("Next", systemImage: "chevron.right")
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
    }

    private func startTimer() {
        guard let timeLimit = quizContent.timeLimitMinutes else { return }

        timeRemaining = timeLimit * 60

        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if let remaining = timeRemaining {
                if remaining > 0 {
                    timeRemaining = remaining - 1
                } else {
                    timer?.invalidate()
                    submitQuiz()
                }
            }
        }
    }

    private func formatTime(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let secs = seconds % 60
        return String(format: "%d:%02d", minutes, secs)
    }

    private func submitQuiz() {
        isSubmitting = true
        timer?.invalidate()

        // Calculate results
        var totalPoints = 0
        var earnedPoints = 0
        var answers: [QuizAnswer] = []

        for question in questions {
            let selected = selectedAnswers[question.id] ?? []
            let correct = Set(selected) == Set(question.correctAnswer)

            let pointsEarned = correct ? question.points : 0
            totalPoints += question.points
            earnedPoints += pointsEarned

            answers.append(QuizAnswer(
                questionId: question.id,
                selectedAnswer: selected,
                isCorrect: correct,
                points: pointsEarned
            ))
        }

        let score = totalPoints > 0 ? (earnedPoints * 100) / totalPoints : 0
        let passed = score >= quizContent.passingScore

        quizResult = QuizResult(
            score: score,
            passed: passed,
            earnedPoints: earnedPoints,
            totalPoints: totalPoints,
            correctCount: answers.filter { $0.isCorrect }.count,
            totalCount: questions.count,
            answers: answers
        )

        isSubmitting = false
        showResults = true
    }

    private func resetQuiz() {
        currentQuestionIndex = 0
        selectedAnswers = [:]
        showResults = false
        quizResult = nil
        textAnswer = ""
        startTimer()
    }
}

// MARK: - Quiz Result

struct QuizResult {
    let score: Int
    let passed: Bool
    let earnedPoints: Int
    let totalPoints: Int
    let correctCount: Int
    let totalCount: Int
    let answers: [QuizAnswer]
}

// MARK: - Quiz Results View

struct QuizResultsView: View {
    let result: QuizResult
    let quizContent: QuizContent
    let onRetry: () -> Void
    let onDone: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                // Score display
                VStack(spacing: 16) {
                    ZStack {
                        Circle()
                            .stroke(Color(.systemGray5), lineWidth: 12)
                            .frame(width: 150, height: 150)

                        Circle()
                            .trim(from: 0, to: CGFloat(result.score) / 100)
                            .stroke(
                                result.passed ? Color.green : Color.red,
                                style: StrokeStyle(lineWidth: 12, lineCap: .round)
                            )
                            .frame(width: 150, height: 150)
                            .rotationEffect(.degrees(-90))

                        VStack {
                            Text("\(result.score)%")
                                .font(.system(size: 36, weight: .bold))
                            Text(result.passed ? "Passed" : "Failed")
                                .font(.caption)
                                .foregroundColor(result.passed ? .green : .red)
                        }
                    }

                    Text(result.passed ? "Congratulations!" : "Keep trying!")
                        .font(.title2)
                        .fontWeight(.semibold)
                }

                // Stats
                HStack(spacing: 32) {
                    VStack {
                        Text("\(result.correctCount)")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(.green)
                        Text("Correct")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    VStack {
                        Text("\(result.totalCount - result.correctCount)")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(.red)
                        Text("Wrong")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    VStack {
                        Text("\(quizContent.passingScore)%")
                            .font(.title)
                            .fontWeight(.bold)
                        Text("Required")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(12)

                // Action buttons
                VStack(spacing: 12) {
                    if result.passed {
                        Button {
                            onDone()
                        } label: {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Continue")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                    } else if quizContent.allowRetakes {
                        Button {
                            onRetry()
                        } label: {
                            HStack {
                                Image(systemName: "arrow.counterclockwise")
                                Text("Try Again")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)

                        Button {
                            onDone()
                        } label: {
                            Text("Exit Quiz")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    } else {
                        Button {
                            onDone()
                        } label: {
                            Text("Close")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                    }
                }
            }
            .padding()
        }
    }
}

// MARK: - Preview

#Preview {
    let store = try! TrainingStore()
    let manager = TrainingManager(store: store)

    let quizContent = QuizContent(
        questions: [
            QuizQuestion(
                id: "q1",
                type: .multipleChoice,
                question: "What is the most secure way to store passwords?",
                options: ["Notebook", "Password manager", "Browser autofill", "Email to yourself"],
                correctAnswer: ["Password manager"],
                explanation: "Password managers encrypt and securely store your passwords.",
                points: 10,
                order: 1
            ),
            QuizQuestion(
                id: "q2",
                type: .trueFalse,
                question: "Using public WiFi with a VPN is completely safe.",
                options: ["True", "False"],
                correctAnswer: ["False"],
                explanation: "While VPNs add security, no solution is 100% safe.",
                points: 10,
                order: 2
            )
        ],
        passingScore: 70,
        allowRetakes: true
    )

    let lesson = Lesson(
        id: "test",
        moduleId: "mod1",
        type: .quiz,
        title: "Security Quiz",
        content: .quiz(quizContent),
        order: 1,
        estimatedMinutes: 10
    )

    return QuizView(
        lesson: lesson,
        quizContent: quizContent,
        manager: manager,
        onComplete: { _, _ in }
    )
}
