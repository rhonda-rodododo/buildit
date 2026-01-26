// QRCodeView.swift
// BuildIt - Decentralized Mesh Communication
//
// QR code generation and display component.

import SwiftUI
import CoreImage.CIFilterBuiltins

/// A view that displays a QR code for the given content
struct QRCodeView: View {
    let content: String
    var size: CGFloat = 200
    var foregroundColor: Color = .black
    var backgroundColor: Color = .white
    var errorCorrectionLevel: ErrorCorrectionLevel = .medium

    enum ErrorCorrectionLevel: String {
        case low = "L"
        case medium = "M"
        case quartile = "Q"
        case high = "H"
    }

    var body: some View {
        if let qrImage = generateQRCode() {
            Image(uiImage: qrImage)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
                .accessibilityLabel("QR Code")
                .accessibilityHint("Contains your public key for sharing")
                .accessibilityAddTraits(.isImage)
        } else {
            Rectangle()
                .fill(Color.gray.opacity(0.2))
                .frame(width: size, height: size)
                .overlay {
                    Image(systemName: "qrcode")
                        .font(.largeTitle)
                        .foregroundColor(.gray)
                }
        }
    }

    private func generateQRCode() -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()

        guard let data = content.data(using: .utf8) else {
            return nil
        }

        filter.setValue(data, forKey: "inputMessage")
        filter.setValue(errorCorrectionLevel.rawValue, forKey: "inputCorrectionLevel")

        guard let outputImage = filter.outputImage else {
            return nil
        }

        // Scale up the image for better quality
        let scale = size / outputImage.extent.width
        let scaledImage = outputImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))

        // Apply colors
        let coloredImage = applyColors(to: scaledImage)

        // Convert to UIImage
        if let cgImage = context.createCGImage(coloredImage, from: coloredImage.extent) {
            return UIImage(cgImage: cgImage)
        }

        return nil
    }

    private func applyColors(to image: CIImage) -> CIImage {
        // Convert SwiftUI colors to CIColors
        let fgColor = CIColor(color: UIColor(foregroundColor))
        let bgColor = CIColor(color: UIColor(backgroundColor))

        // Apply false color filter to change colors
        let colorFilter = CIFilter.falseColor()
        colorFilter.inputImage = image
        colorFilter.color0 = fgColor
        colorFilter.color1 = bgColor

        return colorFilter.outputImage ?? image
    }
}

/// A view for displaying the user's identity QR code with styling
struct IdentityQRCodeView: View {
    let npub: String
    @State private var showCopied = false

    var body: some View {
        VStack(spacing: 24) {
            // QR Code with border
            ZStack {
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.white)
                    .shadow(color: .black.opacity(0.1), radius: 10, y: 5)

                VStack(spacing: 16) {
                    QRCodeView(
                        content: npub,
                        size: 200,
                        errorCorrectionLevel: .high
                    )

                    // npub display
                    VStack(spacing: 4) {
                        Text("Your npub")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text(truncatedNpub)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.primary)
                    }
                }
                .padding(24)
            }
            .frame(width: 280, height: 320)

            // Copy button
            Button {
                UIPasteboard.general.string = npub
                showCopied = true

                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    showCopied = false
                }
            } label: {
                HStack {
                    Image(systemName: showCopied ? "checkmark" : "doc.on.doc")
                    Text(showCopied ? "Copied!" : "Copy npub")
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .padding(.horizontal, 40)
            .accessibilityLabel(showCopied ? "Copied to clipboard" : "Copy public key")
            .accessibilityHint("Double tap to copy your public key to clipboard")

            // Share button
            ShareLink(item: npub) {
                HStack {
                    Image(systemName: "square.and.arrow.up")
                    Text("Share")
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 40)
            .accessibilityLabel("Share public key")
            .accessibilityHint("Double tap to share your public key with others")
        }
    }

    private var truncatedNpub: String {
        if npub.count > 30 {
            return String(npub.prefix(15)) + "..." + String(npub.suffix(10))
        }
        return npub
    }
}

/// A compact QR code button that expands to show the full code
struct CompactQRCodeButton: View {
    let content: String
    @State private var showQRCode = false

    var body: some View {
        Button {
            showQRCode = true
        } label: {
            HStack {
                Image(systemName: "qrcode")
                Text("Show QR Code")
            }
        }
        .sheet(isPresented: $showQRCode) {
            NavigationStack {
                VStack {
                    QRCodeView(content: content, size: 250)
                        .padding()

                    Text(content)
                        .font(.system(.caption, design: .monospaced))
                        .padding()
                        .background(Color(.systemGray6))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .padding(.horizontal)
                        .textSelection(.enabled)
                }
                .navigationTitle("QR Code")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") {
                            showQRCode = false
                        }
                    }
                }
            }
        }
    }
}

/// Avatar with QR code overlay for profile sharing
struct ProfileQRAvatar: View {
    let npub: String
    let avatarSize: CGFloat = 80
    @State private var showQRCode = false

    var body: some View {
        Button {
            showQRCode = true
        } label: {
            ZStack(alignment: .bottomTrailing) {
                // Avatar placeholder
                Circle()
                    .fill(Color.blue.opacity(0.2))
                    .frame(width: avatarSize, height: avatarSize)
                    .overlay {
                        Image(systemName: "person.fill")
                            .font(.largeTitle)
                            .foregroundColor(.blue)
                    }

                // QR code badge
                Circle()
                    .fill(Color.white)
                    .frame(width: 28, height: 28)
                    .shadow(radius: 2)
                    .overlay {
                        Image(systemName: "qrcode")
                            .font(.system(size: 14))
                            .foregroundColor(.blue)
                    }
            }
        }
        .sheet(isPresented: $showQRCode) {
            NavigationStack {
                IdentityQRCodeView(npub: npub)
                    .padding()
                    .navigationTitle("Your Identity")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") {
                                showQRCode = false
                            }
                        }
                    }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 40) {
        QRCodeView(
            content: "npub1abc123def456...",
            size: 150
        )

        IdentityQRCodeView(npub: "npub1abcdefghijklmnopqrstuvwxyz0123456789")

        CompactQRCodeButton(content: "buildit://connect?npub=abc123")

        ProfileQRAvatar(npub: "npub1test")
    }
    .padding()
}
