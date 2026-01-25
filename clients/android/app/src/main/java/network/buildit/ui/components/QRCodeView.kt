package network.buildit.ui.components

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import network.buildit.ui.theme.BuildItTheme

/**
 * Displays a QR code for device pairing or sharing.
 *
 * Features:
 * - Generates QR code from data string
 * - Configurable size and colors
 * - Error correction for damaged codes
 * - Loading state while generating
 */
@Composable
fun QRCodeView(
    data: String,
    modifier: Modifier = Modifier,
    size: Dp = 200.dp,
    backgroundColor: Color = Color.White,
    foregroundColor: Color = Color.Black,
    contentDescription: String = "QR Code"
) {
    var bitmap by remember { mutableStateOf<Bitmap?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    val sizePx = with(LocalDensity.current) { size.toPx().toInt() }

    LaunchedEffect(data, sizePx) {
        isLoading = true
        bitmap = withContext(Dispatchers.Default) {
            generateQRCode(
                data = data,
                size = sizePx,
                backgroundColor = backgroundColor,
                foregroundColor = foregroundColor
            )
        }
        isLoading = false
    }

    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(16.dp))
            .background(backgroundColor)
            .border(
                width = 2.dp,
                color = MaterialTheme.colorScheme.outline,
                shape = RoundedCornerShape(16.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        when {
            isLoading -> {
                CircularProgressIndicator(
                    modifier = Modifier.size(48.dp),
                    color = MaterialTheme.colorScheme.primary
                )
            }
            bitmap != null -> {
                Image(
                    bitmap = bitmap!!.asImageBitmap(),
                    contentDescription = contentDescription,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    contentScale = ContentScale.Fit
                )
            }
            else -> {
                Icon(
                    imageVector = Icons.Default.QrCode,
                    contentDescription = "QR Code placeholder",
                    modifier = Modifier.size(64.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Generates a QR code bitmap from data.
 */
private fun generateQRCode(
    data: String,
    size: Int,
    backgroundColor: Color,
    foregroundColor: Color
): Bitmap? {
    return try {
        val hints = mapOf(
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.H,
            EncodeHintType.MARGIN to 0,
            EncodeHintType.CHARACTER_SET to "UTF-8"
        )

        val writer = QRCodeWriter()
        val bitMatrix = writer.encode(data, BarcodeFormat.QR_CODE, size, size, hints)

        val bgColor = backgroundColor.toArgb()
        val fgColor = foregroundColor.toArgb()

        val pixels = IntArray(size * size)
        for (y in 0 until size) {
            for (x in 0 until size) {
                pixels[y * size + x] = if (bitMatrix[x, y]) fgColor else bgColor
            }
        }

        Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
            setPixels(pixels, 0, size, 0, 0, size, size)
        }
    } catch (e: Exception) {
        null
    }
}

/**
 * Converts a Compose Color to Android Color int.
 */
private fun Color.toArgb(): Int {
    return AndroidColor.argb(
        (alpha * 255).toInt(),
        (red * 255).toInt(),
        (green * 255).toInt(),
        (blue * 255).toInt()
    )
}

/**
 * QR code card with title and description.
 */
@Composable
fun QRCodeCard(
    data: String,
    title: String,
    description: String? = null,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 2.dp
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )

            QRCodeView(
                data = data,
                size = 200.dp
            )

            if (description != null) {
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * QR scanner overlay frame.
 */
@Composable
fun QRScannerFrame(
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .aspectRatio(1f)
            .padding(32.dp)
    ) {
        // Corner brackets
        val cornerSize = 32.dp
        val cornerStroke = 4.dp
        val cornerColor = MaterialTheme.colorScheme.primary

        // Top-left corner
        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .size(cornerSize)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .size(width = cornerSize, height = cornerStroke)
                    .background(cornerColor)
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .size(width = cornerStroke, height = cornerSize)
                    .background(cornerColor)
            )
        }

        // Top-right corner
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .size(cornerSize)
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(width = cornerSize, height = cornerStroke)
                    .background(cornerColor)
            )
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(width = cornerStroke, height = cornerSize)
                    .background(cornerColor)
            )
        }

        // Bottom-left corner
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .size(cornerSize)
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .size(width = cornerSize, height = cornerStroke)
                    .background(cornerColor)
            )
            Box(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .size(width = cornerStroke, height = cornerSize)
                    .background(cornerColor)
            )
        }

        // Bottom-right corner
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .size(cornerSize)
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .size(width = cornerSize, height = cornerStroke)
                    .background(cornerColor)
            )
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .size(width = cornerStroke, height = cornerSize)
                    .background(cornerColor)
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun QRCodePreview() {
    BuildItTheme {
        QRCodeCard(
            data = "buildit://pair?pubkey=abc123def456",
            title = "Scan to Link Device",
            description = "Scan this code with another device to link them"
        )
    }
}
