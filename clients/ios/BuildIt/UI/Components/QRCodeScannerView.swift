// QRCodeScannerView.swift
// BuildIt - Decentralized Mesh Communication
//
// QR code scanner component using AVFoundation.

import SwiftUI
import AVFoundation

/// A view that provides QR code scanning functionality
struct QRCodeScannerView: View {
    let onCodeScanned: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var isFlashOn = false
    @State private var scannerError: ScannerError?
    @State private var showPermissionAlert = false

    var body: some View {
        NavigationStack {
            ZStack {
                // Scanner view
                ScannerViewRepresentable(
                    onCodeScanned: { code in
                        onCodeScanned(code)
                    },
                    isFlashOn: $isFlashOn,
                    error: $scannerError
                )
                .ignoresSafeArea()

                // Overlay with scanning frame
                ScannerOverlay()

                // Error handling
                if let error = scannerError {
                    VStack {
                        Spacer()

                        VStack(spacing: 16) {
                            Image(systemName: error.icon)
                                .font(.system(size: 48))
                                .foregroundColor(.white)

                            Text(error.title)
                                .font(.headline)
                                .foregroundColor(.white)

                            Text(error.message)
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.8))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)

                            if error == .cameraAccessDenied {
                                Button("Open Settings") {
                                    if let url = URL(string: UIApplication.openSettingsURLString) {
                                        UIApplication.shared.open(url)
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                            }
                        }
                        .padding()
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .padding()

                        Spacer()
                    }
                }
            }
            .navigationTitle("Scan QR Code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isFlashOn.toggle()
                    } label: {
                        Image(systemName: isFlashOn ? "bolt.fill" : "bolt.slash")
                    }
                }
            }
            .onAppear {
                checkCameraPermission()
            }
        }
    }

    private func checkCameraPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if !granted {
                        scannerError = .cameraAccessDenied
                    }
                }
            }
        case .denied, .restricted:
            scannerError = .cameraAccessDenied
        case .authorized:
            scannerError = nil
        @unknown default:
            break
        }
    }
}

// MARK: - Scanner Overlay

struct ScannerOverlay: View {
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Semi-transparent background
                Color.black.opacity(0.5)

                // Clear scanning area
                let scanSize = min(geometry.size.width, geometry.size.height) * 0.7
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.clear)
                    .frame(width: scanSize, height: scanSize)
                    .overlay {
                        // Corner brackets
                        ScannerCorners(size: scanSize)
                    }
                    .blendMode(.destinationOut)

                // Scan line animation
                ScanLineView(scanSize: scanSize)

                // Instructions
                VStack {
                    Spacer()

                    Text("Position QR code within the frame")
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding()
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                        .padding(.bottom, 100)
                }
            }
            .compositingGroup()
        }
    }
}

// MARK: - Scanner Corners

struct ScannerCorners: View {
    let size: CGFloat
    let cornerLength: CGFloat = 30
    let lineWidth: CGFloat = 4

    var body: some View {
        ZStack {
            // Top-left
            CornerShape(position: .topLeft)
                .stroke(Color.accentColor, lineWidth: lineWidth)
                .frame(width: cornerLength, height: cornerLength)
                .position(x: cornerLength/2, y: cornerLength/2)

            // Top-right
            CornerShape(position: .topRight)
                .stroke(Color.accentColor, lineWidth: lineWidth)
                .frame(width: cornerLength, height: cornerLength)
                .position(x: size - cornerLength/2, y: cornerLength/2)

            // Bottom-left
            CornerShape(position: .bottomLeft)
                .stroke(Color.accentColor, lineWidth: lineWidth)
                .frame(width: cornerLength, height: cornerLength)
                .position(x: cornerLength/2, y: size - cornerLength/2)

            // Bottom-right
            CornerShape(position: .bottomRight)
                .stroke(Color.accentColor, lineWidth: lineWidth)
                .frame(width: cornerLength, height: cornerLength)
                .position(x: size - cornerLength/2, y: size - cornerLength/2)
        }
        .frame(width: size, height: size)
    }
}

struct CornerShape: Shape {
    enum Position {
        case topLeft, topRight, bottomLeft, bottomRight
    }

    let position: Position

    func path(in rect: CGRect) -> Path {
        var path = Path()

        switch position {
        case .topLeft:
            path.move(to: CGPoint(x: 0, y: rect.height))
            path.addLine(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: rect.width, y: 0))

        case .topRight:
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: rect.width, y: 0))
            path.addLine(to: CGPoint(x: rect.width, y: rect.height))

        case .bottomLeft:
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: 0, y: rect.height))
            path.addLine(to: CGPoint(x: rect.width, y: rect.height))

        case .bottomRight:
            path.move(to: CGPoint(x: 0, y: rect.height))
            path.addLine(to: CGPoint(x: rect.width, y: rect.height))
            path.addLine(to: CGPoint(x: rect.width, y: 0))
        }

        return path
    }
}

// MARK: - Scan Line Animation

struct ScanLineView: View {
    let scanSize: CGFloat
    @State private var offset: CGFloat = 0

    var body: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    colors: [.clear, Color.accentColor.opacity(0.5), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(width: scanSize * 0.8, height: 2)
            .offset(y: offset)
            .onAppear {
                withAnimation(
                    .easeInOut(duration: 2.0)
                    .repeatForever(autoreverses: true)
                ) {
                    offset = scanSize / 2 - 20
                }
            }
    }
}

// MARK: - Scanner Error

enum ScannerError: Error, Equatable {
    case cameraAccessDenied
    case cameraUnavailable
    case invalidQRCode

    var title: String {
        switch self {
        case .cameraAccessDenied:
            return "Camera Access Required"
        case .cameraUnavailable:
            return "Camera Unavailable"
        case .invalidQRCode:
            return "Invalid QR Code"
        }
    }

    var message: String {
        switch self {
        case .cameraAccessDenied:
            return "Please enable camera access in Settings to scan QR codes."
        case .cameraUnavailable:
            return "This device doesn't have a camera available."
        case .invalidQRCode:
            return "The scanned code is not a valid BuildIt QR code."
        }
    }

    var icon: String {
        switch self {
        case .cameraAccessDenied:
            return "camera.fill"
        case .cameraUnavailable:
            return "video.slash.fill"
        case .invalidQRCode:
            return "qrcode"
        }
    }
}

// MARK: - AVFoundation Scanner

struct ScannerViewRepresentable: UIViewControllerRepresentable {
    let onCodeScanned: (String) -> Void
    @Binding var isFlashOn: Bool
    @Binding var error: ScannerError?

    func makeUIViewController(context: Context) -> ScannerViewController {
        let controller = ScannerViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: ScannerViewController, context: Context) {
        controller.setFlash(isFlashOn)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, ScannerViewControllerDelegate {
        let parent: ScannerViewRepresentable

        init(_ parent: ScannerViewRepresentable) {
            self.parent = parent
        }

        func didFindCode(_ code: String) {
            parent.onCodeScanned(code)
        }

        func didFailWithError(_ error: ScannerError) {
            parent.error = error
        }
    }
}

protocol ScannerViewControllerDelegate: AnyObject {
    func didFindCode(_ code: String)
    func didFailWithError(_ error: ScannerError)
}

class ScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    weak var delegate: ScannerViewControllerDelegate?

    private var captureSession: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var hasFoundCode = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupCaptureSession()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        startScanning()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopScanning()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    private func setupCaptureSession() {
        let session = AVCaptureSession()

        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else {
            delegate?.didFailWithError(.cameraUnavailable)
            return
        }

        do {
            let videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)

            if session.canAddInput(videoInput) {
                session.addInput(videoInput)
            }

            let metadataOutput = AVCaptureMetadataOutput()

            if session.canAddOutput(metadataOutput) {
                session.addOutput(metadataOutput)
                metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
                metadataOutput.metadataObjectTypes = [.qr]
            }

            let previewLayer = AVCaptureVideoPreviewLayer(session: session)
            previewLayer.frame = view.bounds
            previewLayer.videoGravity = .resizeAspectFill
            view.layer.addSublayer(previewLayer)

            self.captureSession = session
            self.previewLayer = previewLayer
        } catch {
            delegate?.didFailWithError(.cameraUnavailable)
        }
    }

    func startScanning() {
        hasFoundCode = false
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession?.startRunning()
        }
    }

    func stopScanning() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession?.stopRunning()
        }
    }

    func setFlash(_ on: Bool) {
        guard let device = AVCaptureDevice.default(for: .video),
              device.hasTorch else { return }

        do {
            try device.lockForConfiguration()
            device.torchMode = on ? .on : .off
            device.unlockForConfiguration()
        } catch {
            // Flash toggle failed silently
        }
    }

    // MARK: - AVCaptureMetadataOutputObjectsDelegate

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard !hasFoundCode else { return }

        if let metadataObject = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
           metadataObject.type == .qr,
           let code = metadataObject.stringValue {
            hasFoundCode = true

            // Haptic feedback
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)

            // Notify delegate
            delegate?.didFindCode(code)
        }
    }
}

// MARK: - Preview

#Preview {
    QRCodeScannerView { code in
        print("Scanned: \(code)")
    }
}
