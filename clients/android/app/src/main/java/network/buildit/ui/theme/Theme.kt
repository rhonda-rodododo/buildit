package network.buildit.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

// BuildIt Brand Colors
private val BuildItPrimary = Color(0xFF6366F1) // Indigo
private val BuildItPrimaryVariant = Color(0xFF4F46E5)
private val BuildItSecondary = Color(0xFF10B981) // Emerald
private val BuildItSecondaryVariant = Color(0xFF059669)
private val BuildItTertiary = Color(0xFFF59E0B) // Amber

// Light Theme Colors
private val LightBackground = Color(0xFFFAFAFA)
private val LightSurface = Color(0xFFFFFFFF)
private val LightSurfaceVariant = Color(0xFFF3F4F6)
private val LightOnBackground = Color(0xFF111827)
private val LightOnSurface = Color(0xFF1F2937)
private val LightOnSurfaceVariant = Color(0xFF6B7280)

// Dark Theme Colors
private val DarkBackground = Color(0xFF0F172A)
private val DarkSurface = Color(0xFF1E293B)
private val DarkSurfaceVariant = Color(0xFF334155)
private val DarkOnBackground = Color(0xFFF9FAFB)
private val DarkOnSurface = Color(0xFFF3F4F6)
private val DarkOnSurfaceVariant = Color(0xFF9CA3AF)

// Error Colors
private val ErrorLight = Color(0xFFDC2626)
private val ErrorDark = Color(0xFFF87171)

private val LightColorScheme = lightColorScheme(
    primary = BuildItPrimary,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE0E7FF),
    onPrimaryContainer = Color(0xFF1E1B4B),
    secondary = BuildItSecondary,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD1FAE5),
    onSecondaryContainer = Color(0xFF064E3B),
    tertiary = BuildItTertiary,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFEF3C7),
    onTertiaryContainer = Color(0xFF78350F),
    error = ErrorLight,
    onError = Color.White,
    errorContainer = Color(0xFFFEE2E2),
    onErrorContainer = Color(0xFF7F1D1D),
    background = LightBackground,
    onBackground = LightOnBackground,
    surface = LightSurface,
    onSurface = LightOnSurface,
    surfaceVariant = LightSurfaceVariant,
    onSurfaceVariant = LightOnSurfaceVariant,
    outline = Color(0xFFD1D5DB),
    outlineVariant = Color(0xFFE5E7EB)
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF818CF8), // Lighter indigo for dark theme
    onPrimary = Color(0xFF1E1B4B),
    primaryContainer = Color(0xFF3730A3),
    onPrimaryContainer = Color(0xFFE0E7FF),
    secondary = Color(0xFF34D399), // Lighter emerald for dark theme
    onSecondary = Color(0xFF064E3B),
    secondaryContainer = Color(0xFF047857),
    onSecondaryContainer = Color(0xFFD1FAE5),
    tertiary = Color(0xFFFBBF24), // Lighter amber for dark theme
    onTertiary = Color(0xFF78350F),
    tertiaryContainer = Color(0xFFB45309),
    onTertiaryContainer = Color(0xFFFEF3C7),
    error = ErrorDark,
    onError = Color(0xFF7F1D1D),
    errorContainer = Color(0xFF991B1B),
    onErrorContainer = Color(0xFFFEE2E2),
    background = DarkBackground,
    onBackground = DarkOnBackground,
    surface = DarkSurface,
    onSurface = DarkOnSurface,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = DarkOnSurfaceVariant,
    outline = Color(0xFF4B5563),
    outlineVariant = Color(0xFF374151)
)

/**
 * BuildIt Material 3 Theme.
 *
 * Supports:
 * - Light and dark mode
 * - Dynamic color on Android 12+
 * - Edge-to-edge display
 */
@Composable
fun BuildItTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Color.Transparent.toArgb()
            window.navigationBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !darkTheme
                isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = BuildItTypography,
        content = content
    )
}

/**
 * BuildIt Typography using Material 3 type scale.
 */
val BuildItTypography = androidx.compose.material3.Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 57.sp,
        lineHeight = 64.sp,
        letterSpacing = (-0.25).sp
    ),
    displayMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 45.sp,
        lineHeight = 52.sp,
        letterSpacing = 0.sp
    ),
    displaySmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 36.sp,
        lineHeight = 44.sp,
        letterSpacing = 0.sp
    ),
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 32.sp,
        lineHeight = 40.sp,
        letterSpacing = 0.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 28.sp,
        lineHeight = 36.sp,
        letterSpacing = 0.sp
    ),
    headlineSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 32.sp,
        letterSpacing = 0.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = 0.sp
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.15.sp
    ),
    titleSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.5.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.25.sp
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.4.sp
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    )
)

/**
 * Custom color extensions for BuildIt-specific use cases.
 */
object BuildItColors {
    // Message bubbles
    val SentMessageBubble = Color(0xFF6366F1)
    val ReceivedMessageBubble = Color(0xFFE5E7EB)
    val SentMessageBubbleDark = Color(0xFF4F46E5)
    val ReceivedMessageBubbleDark = Color(0xFF374151)

    // Status indicators
    val Online = Color(0xFF10B981)
    val Away = Color(0xFFF59E0B)
    val Offline = Color(0xFF6B7280)

    // BLE status
    val BleConnected = Color(0xFF10B981)
    val BleScanning = Color(0xFF3B82F6)
    val BleDisconnected = Color(0xFFEF4444)

    // Encryption indicators
    val Encrypted = Color(0xFF10B981)
    val Unencrypted = Color(0xFFF59E0B)
}
