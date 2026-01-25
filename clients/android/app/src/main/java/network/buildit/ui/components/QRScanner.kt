package network.buildit.ui.components

import android.Manifest
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

/**
 * QR Code scanner composable using CameraX and MLKit.
 *
 * @param modifier Modifier for the composable
 * @param onQrCodeScanned Callback when a QR code is successfully scanned
 * @param onError Callback when an error occurs
 */
@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun QRScanner(
    modifier: Modifier = Modifier,
    onQrCodeScanned: (String) -> Unit,
    onError: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val cameraPermissionState = rememberPermissionState(Manifest.permission.CAMERA)

    var hasScanned by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (!cameraPermissionState.status.isGranted) {
            cameraPermissionState.launchPermissionRequest()
        }
    }

    if (!cameraPermissionState.status.isGranted) {
        Box(
            modifier = modifier,
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "Camera permission is required to scan QR codes",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        return
    }

    Box(modifier = modifier) {
        val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
        val executor = remember { Executors.newSingleThreadExecutor() }

        DisposableEffect(Unit) {
            onDispose {
                try {
                    cameraProviderFuture.get().unbindAll()
                } catch (e: Exception) {
                    // Ignore cleanup errors
                }
            }
        }

        AndroidView(
            factory = { ctx ->
                val previewView = PreviewView(ctx).apply {
                    scaleType = PreviewView.ScaleType.FILL_CENTER
                }

                cameraProviderFuture.addListener({
                    val cameraProvider = cameraProviderFuture.get()

                    val preview = Preview.Builder()
                        .build()
                        .also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }

                    val imageAnalysis = ImageAnalysis.Builder()
                        .setTargetResolution(Size(1280, 720))
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also { analysis ->
                            analysis.setAnalyzer(executor) { imageProxy ->
                                if (hasScanned) {
                                    imageProxy.close()
                                    return@setAnalyzer
                                }

                                @androidx.camera.core.ExperimentalGetImage
                                val mediaImage = imageProxy.image
                                if (mediaImage != null) {
                                    val image = InputImage.fromMediaImage(
                                        mediaImage,
                                        imageProxy.imageInfo.rotationDegrees
                                    )

                                    val scanner = BarcodeScanning.getClient()
                                    scanner.process(image)
                                        .addOnSuccessListener { barcodes ->
                                            for (barcode in barcodes) {
                                                if (barcode.format == Barcode.FORMAT_QR_CODE) {
                                                    barcode.rawValue?.let { value ->
                                                        if (!hasScanned) {
                                                            hasScanned = true
                                                            onQrCodeScanned(value)
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        .addOnFailureListener { e ->
                                            onError("Failed to scan: ${e.message}")
                                        }
                                        .addOnCompleteListener {
                                            imageProxy.close()
                                        }
                                } else {
                                    imageProxy.close()
                                }
                            }
                        }

                    val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                    try {
                        cameraProvider.unbindAll()
                        cameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            cameraSelector,
                            preview,
                            imageAnalysis
                        )
                    } catch (e: Exception) {
                        onError("Failed to start camera: ${e.message}")
                    }
                }, ContextCompat.getMainExecutor(ctx))

                previewView
            },
            modifier = Modifier.fillMaxSize()
        )

        // Scanning overlay
        ScannerOverlay(
            modifier = Modifier.fillMaxSize()
        )
    }
}

/**
 * Overlay with a transparent scanning window.
 */
@Composable
private fun ScannerOverlay(
    modifier: Modifier = Modifier
) {
    val overlayColor = Color.Black.copy(alpha = 0.6f)
    val borderColor = MaterialTheme.colorScheme.primary

    Canvas(modifier = modifier) {
        val canvasWidth = size.width
        val canvasHeight = size.height

        // Scanner window size (centered, square)
        val windowSize = minOf(canvasWidth, canvasHeight) * 0.7f
        val left = (canvasWidth - windowSize) / 2
        val top = (canvasHeight - windowSize) / 2
        val right = left + windowSize
        val bottom = top + windowSize
        val cornerRadius = 24.dp.toPx()

        // Draw semi-transparent overlay
        drawRect(
            color = overlayColor,
            topLeft = Offset.Zero,
            size = size
        )

        // Cut out the scanner window
        drawRoundRect(
            color = Color.Transparent,
            topLeft = Offset(left, top),
            size = androidx.compose.ui.geometry.Size(windowSize, windowSize),
            cornerRadius = CornerRadius(cornerRadius, cornerRadius),
            blendMode = BlendMode.Clear
        )

        // Draw border around scanner window
        drawRoundRect(
            color = borderColor,
            topLeft = Offset(left, top),
            size = androidx.compose.ui.geometry.Size(windowSize, windowSize),
            cornerRadius = CornerRadius(cornerRadius, cornerRadius),
            style = Stroke(width = 4.dp.toPx())
        )

        // Draw corner accents
        val accentLength = 40.dp.toPx()
        val accentWidth = 6.dp.toPx()

        // Top-left corner
        drawLine(
            color = borderColor,
            start = Offset(left, top + cornerRadius),
            end = Offset(left, top + cornerRadius + accentLength),
            strokeWidth = accentWidth
        )
        drawLine(
            color = borderColor,
            start = Offset(left + cornerRadius, top),
            end = Offset(left + cornerRadius + accentLength, top),
            strokeWidth = accentWidth
        )

        // Top-right corner
        drawLine(
            color = borderColor,
            start = Offset(right, top + cornerRadius),
            end = Offset(right, top + cornerRadius + accentLength),
            strokeWidth = accentWidth
        )
        drawLine(
            color = borderColor,
            start = Offset(right - cornerRadius, top),
            end = Offset(right - cornerRadius - accentLength, top),
            strokeWidth = accentWidth
        )

        // Bottom-left corner
        drawLine(
            color = borderColor,
            start = Offset(left, bottom - cornerRadius),
            end = Offset(left, bottom - cornerRadius - accentLength),
            strokeWidth = accentWidth
        )
        drawLine(
            color = borderColor,
            start = Offset(left + cornerRadius, bottom),
            end = Offset(left + cornerRadius + accentLength, bottom),
            strokeWidth = accentWidth
        )

        // Bottom-right corner
        drawLine(
            color = borderColor,
            start = Offset(right, bottom - cornerRadius),
            end = Offset(right, bottom - cornerRadius - accentLength),
            strokeWidth = accentWidth
        )
        drawLine(
            color = borderColor,
            start = Offset(right - cornerRadius, bottom),
            end = Offset(right - cornerRadius - accentLength, bottom),
            strokeWidth = accentWidth
        )
    }
}

/**
 * Simple QR scanner in a card for dialogs.
 */
@Composable
fun QRScannerCard(
    modifier: Modifier = Modifier,
    onQrCodeScanned: (String) -> Unit,
    onError: (String) -> Unit = {}
) {
    Box(
        modifier = modifier
            .size(280.dp)
            .clip(RoundedCornerShape(16.dp))
    ) {
        QRScanner(
            modifier = Modifier.fillMaxSize(),
            onQrCodeScanned = onQrCodeScanned,
            onError = onError
        )
    }
}
