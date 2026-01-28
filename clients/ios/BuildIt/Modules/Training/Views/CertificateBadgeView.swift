// CertificateBadgeView.swift
// BuildIt - Decentralized Mesh Communication
//
// Certification badge display component.

import SwiftUI

/// Certificate badge view for displaying earned certifications
public struct CertificateBadgeView: View {
    let certification: Certification
    let course: Course?

    @State private var showVerificationCode = false

    public init(certification: Certification, course: Course? = nil) {
        self.certification = certification
        self.course = course
    }

    public var body: some View {
        VStack(spacing: 16) {
            // Badge icon
            badgeIcon

            // Course name
            Text(course?.title ?? "Certificate")
                .font(.headline)
                .multilineTextAlignment(.center)

            // Earned date
            VStack(spacing: 4) {
                Text("Earned")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text(certification.earnedAt.formatted(date: .abbreviated, time: .omitted))
                    .font(.subheadline)
                    .fontWeight(.medium)
            }

            // Expiration
            if let expiresAt = certification.expiresAt {
                expirationView(expiresAt)
            }

            // Verification code
            verificationSection

            // Status badge
            statusBadge
        }
        .padding(20)
        .background(backgroundGradient)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
    }

    private var badgeIcon: some View {
        ZStack {
            // Outer ring
            Circle()
                .stroke(certification.isValid ? Color.green : Color.gray, lineWidth: 3)
                .frame(width: 80, height: 80)

            // Inner fill
            Circle()
                .fill(certification.isValid ? Color.green.opacity(0.2) : Color.gray.opacity(0.2))
                .frame(width: 70, height: 70)

            // Icon
            Image(systemName: certification.isValid ? "checkmark.seal.fill" : "xmark.seal")
                .font(.system(size: 35))
                .foregroundColor(certification.isValid ? .green : .gray)
        }
    }

    private func expirationView(_ expiresAt: Date) -> some View {
        VStack(spacing: 4) {
            if expiresAt < Date() {
                Label("Expired", systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundColor(.red)
            } else if certification.isExpiringSoon {
                Label("Expiring Soon", systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundColor(.orange)
                Text(expiresAt.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            } else {
                Text("Valid until")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text(expiresAt.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .fontWeight(.medium)
            }
        }
    }

    private var verificationSection: some View {
        VStack(spacing: 8) {
            Button {
                showVerificationCode.toggle()
            } label: {
                HStack {
                    Image(systemName: "qrcode")
                    Text(showVerificationCode ? "Hide Code" : "Show Verification Code")
                }
                .font(.caption)
            }

            if showVerificationCode {
                Text(certification.verificationCode)
                    .font(.system(.caption, design: .monospaced))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(.systemBackground))
                    .cornerRadius(6)
                    .onTapGesture {
                        UIPasteboard.general.string = certification.verificationCode
                    }
            }
        }
    }

    private var statusBadge: some View {
        Group {
            if certification.revokedAt != nil {
                Label("Revoked", systemImage: "xmark.circle.fill")
                    .font(.caption)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(Color.red.opacity(0.2))
                    .foregroundColor(.red)
                    .cornerRadius(12)
            } else if !certification.isValid {
                Label("Invalid", systemImage: "exclamationmark.circle.fill")
                    .font(.caption)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(Color.orange.opacity(0.2))
                    .foregroundColor(.orange)
                    .cornerRadius(12)
            } else {
                Label("Valid", systemImage: "checkmark.circle.fill")
                    .font(.caption)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(Color.green.opacity(0.2))
                    .foregroundColor(.green)
                    .cornerRadius(12)
            }
        }
    }

    private var backgroundGradient: some View {
        LinearGradient(
            colors: certification.isValid
                ? [Color(.systemBackground), Color.green.opacity(0.05)]
                : [Color(.systemBackground), Color.gray.opacity(0.05)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

// MARK: - Certifications List View

public struct CertificationsListView: View {
    @ObservedObject var store: TrainingStore
    let manager: TrainingManager

    @State private var selectedCertification: CertificationEntity?
    @State private var verificationCode = ""
    @State private var showVerify = false
    @State private var verificationResult: CertificationVerification?

    public init(store: TrainingStore, manager: TrainingManager) {
        self.store = store
        self.manager = manager
    }

    public var body: some View {
        NavigationStack {
            Group {
                if store.certifications.isEmpty && !store.isLoading {
                    emptyState
                } else {
                    certificationsList
                }
            }
            .navigationTitle("Certifications")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showVerify = true
                    } label: {
                        Image(systemName: "qrcode.viewfinder")
                    }
                }
            }
            .refreshable {
                await store.loadCertifications()
            }
            .sheet(item: $selectedCertification) { cert in
                certificateDetail(cert)
            }
            .sheet(isPresented: $showVerify) {
                verifySheet
            }
        }
    }

    private var certificationsList: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(store.certifications, id: \.id) { cert in
                    let course = store.getCourse(id: cert.courseId)?.toCourse()

                    CertificateBadgeView(
                        certification: cert.toCertification(),
                        course: course
                    )
                    .onTapGesture {
                        selectedCertification = cert
                    }
                }
            }
            .padding()
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Certifications", systemImage: "checkmark.seal")
        } description: {
            Text("Complete training courses to earn certifications.")
        } actions: {
            NavigationLink {
                CourseListView(store: store, manager: manager)
            } label: {
                Text("Browse Courses")
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private func certificateDetail(_ cert: CertificationEntity) -> some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    let course = store.getCourse(id: cert.courseId)?.toCourse()

                    CertificateBadgeView(
                        certification: cert.toCertification(),
                        course: course
                    )
                    .padding()

                    if let course = course {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Course Details")
                                .font(.headline)

                            DetailInfoRow(title: "Course", value: course.title)
                            DetailInfoRow(title: "Category", value: course.category.displayName)
                            DetailInfoRow(title: "Difficulty", value: course.difficulty.displayName)
                            DetailInfoRow(title: "Duration", value: "\(Int(course.estimatedHours)) hours")
                        }
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                        .padding(.horizontal)
                    }

                    // Share button
                    Button {
                        // Share certification
                    } label: {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                            Text("Share Certificate")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .padding(.horizontal)
                }
            }
            .navigationTitle("Certificate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        selectedCertification = nil
                    }
                }
            }
        }
    }

    private var verifySheet: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 60))
                    .foregroundColor(.accentColor)

                Text("Verify Certification")
                    .font(.title2)
                    .fontWeight(.bold)

                TextField("Enter verification code", text: $verificationCode)
                    .textFieldStyle(.roundedBorder)
                    .autocapitalization(.allCharacters)
                    .padding(.horizontal)

                Button {
                    Task {
                        verificationResult = try? await manager.verifyCertification(code: verificationCode)
                    }
                } label: {
                    Text("Verify")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .padding(.horizontal)
                .disabled(verificationCode.isEmpty)

                if let result = verificationResult {
                    verificationResultView(result)
                }

                Spacer()
            }
            .padding()
            .navigationTitle("Verify")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        showVerify = false
                        verificationCode = ""
                        verificationResult = nil
                    }
                }
            }
        }
    }

    private func verificationResultView(_ result: CertificationVerification) -> some View {
        VStack(spacing: 12) {
            if result.valid {
                Label("Valid Certification", systemImage: "checkmark.circle.fill")
                    .foregroundColor(.green)
                    .font(.headline)

                if let cert = result.certification,
                   let course = result.course {
                    CertificateBadgeView(certification: cert, course: course)
                        .scaleEffect(0.8)
                }
            } else {
                Label(result.error ?? "Invalid", systemImage: "xmark.circle.fill")
                    .foregroundColor(.red)
                    .font(.headline)

                if result.expired == true {
                    Text("This certification has expired.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else if result.revoked == true {
                    Text("This certification has been revoked.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .padding(.horizontal)
    }
}

struct DetailInfoRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Preview

#Preview {
    let certification = Certification(
        id: "test",
        courseId: "course1",
        pubkey: "test",
        earnedAt: Date().addingTimeInterval(-86400 * 30),
        expiresAt: Date().addingTimeInterval(86400 * 335),
        verificationCode: "ABCD-1234-EFGH"
    )

    let course = Course(
        id: "course1",
        title: "Digital Security Fundamentals",
        description: "Learn the basics of digital security.",
        category: .digitalSecurity,
        difficulty: .beginner,
        estimatedHours: 4,
        createdBy: "test"
    )

    return CertificateBadgeView(certification: certification, course: course)
        .padding()
}
