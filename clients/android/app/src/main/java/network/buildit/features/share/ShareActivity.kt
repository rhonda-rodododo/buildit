package network.buildit.features.share

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Parcelable
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import dagger.hilt.android.AndroidEntryPoint
import network.buildit.ui.theme.BuildItTheme

/**
 * Activity for handling share intents from external apps.
 *
 * This activity is launched when a user selects BuildIt from the share sheet
 * in another app. It handles:
 * - ACTION_SEND: Single item sharing (text, image, file)
 * - ACTION_SEND_MULTIPLE: Multiple items sharing (images, files)
 *
 * The activity displays a bottom sheet composer allowing the user to:
 * - Preview shared content
 * - Select a destination (recent DMs, groups, or search for contacts)
 * - Send the shared content with end-to-end encryption
 */
@AndroidEntryPoint
class ShareActivity : ComponentActivity() {

    private val viewModel: ShareViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Process the incoming intent
        handleIntent(intent)

        setContent {
            BuildItTheme {
                ShareComposerScreen(
                    viewModel = viewModel,
                    onDismiss = { finish() },
                    onSendComplete = {
                        // Finish the activity after sending
                        finish()
                    }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    /**
     * Processes the incoming share intent and extracts shared content.
     */
    private fun handleIntent(intent: Intent) {
        when (intent.action) {
            Intent.ACTION_SEND -> handleSingleShare(intent)
            Intent.ACTION_SEND_MULTIPLE -> handleMultipleShare(intent)
        }
    }

    /**
     * Handles ACTION_SEND intent for single item sharing.
     */
    private fun handleSingleShare(intent: Intent) {
        val type = intent.type ?: return

        when {
            type == "text/plain" -> {
                // Extract shared text
                val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
                val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)

                if (!sharedText.isNullOrBlank()) {
                    viewModel.setSharedText(sharedText, subject)
                }
            }
            type.startsWith("image/") -> {
                // Extract shared image
                val imageUri = getParcelableExtraCompat<Uri>(intent, Intent.EXTRA_STREAM)
                if (imageUri != null) {
                    viewModel.addSharedMedia(
                        SharedMediaItem(
                            uri = imageUri,
                            mimeType = type,
                            type = SharedMediaType.IMAGE
                        )
                    )
                }
            }
            type.startsWith("video/") -> {
                // Extract shared video
                val videoUri = getParcelableExtraCompat<Uri>(intent, Intent.EXTRA_STREAM)
                if (videoUri != null) {
                    viewModel.addSharedMedia(
                        SharedMediaItem(
                            uri = videoUri,
                            mimeType = type,
                            type = SharedMediaType.VIDEO
                        )
                    )
                }
            }
            type.startsWith("audio/") -> {
                // Extract shared audio
                val audioUri = getParcelableExtraCompat<Uri>(intent, Intent.EXTRA_STREAM)
                if (audioUri != null) {
                    viewModel.addSharedMedia(
                        SharedMediaItem(
                            uri = audioUri,
                            mimeType = type,
                            type = SharedMediaType.AUDIO
                        )
                    )
                }
            }
            else -> {
                // Handle generic file sharing
                val fileUri = getParcelableExtraCompat<Uri>(intent, Intent.EXTRA_STREAM)
                if (fileUri != null) {
                    viewModel.addSharedMedia(
                        SharedMediaItem(
                            uri = fileUri,
                            mimeType = type,
                            type = SharedMediaType.FILE
                        )
                    )
                }
            }
        }
    }

    /**
     * Handles ACTION_SEND_MULTIPLE intent for multiple items.
     */
    private fun handleMultipleShare(intent: Intent) {
        val type = intent.type ?: return

        when {
            type.startsWith("image/") -> {
                val imageUris = getParcelableArrayListExtraCompat<Uri>(intent, Intent.EXTRA_STREAM)
                imageUris?.forEach { uri ->
                    viewModel.addSharedMedia(
                        SharedMediaItem(
                            uri = uri,
                            mimeType = "image/*",
                            type = SharedMediaType.IMAGE
                        )
                    )
                }
            }
            else -> {
                // Handle multiple files of any type
                val fileUris = getParcelableArrayListExtraCompat<Uri>(intent, Intent.EXTRA_STREAM)
                fileUris?.forEach { uri ->
                    val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
                    val mediaType = when {
                        mimeType.startsWith("image/") -> SharedMediaType.IMAGE
                        mimeType.startsWith("video/") -> SharedMediaType.VIDEO
                        mimeType.startsWith("audio/") -> SharedMediaType.AUDIO
                        else -> SharedMediaType.FILE
                    }
                    viewModel.addSharedMedia(
                        SharedMediaItem(
                            uri = uri,
                            mimeType = mimeType,
                            type = mediaType
                        )
                    )
                }
            }
        }
    }

    /**
     * Compatibility helper for getParcelableExtra.
     */
    @Suppress("DEPRECATION")
    private inline fun <reified T : Parcelable> getParcelableExtraCompat(
        intent: Intent,
        name: String
    ): T? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(name, T::class.java)
        } else {
            intent.getParcelableExtra(name)
        }
    }

    /**
     * Compatibility helper for getParcelableArrayListExtra.
     */
    @Suppress("DEPRECATION")
    private inline fun <reified T : Parcelable> getParcelableArrayListExtraCompat(
        intent: Intent,
        name: String
    ): ArrayList<T>? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableArrayListExtra(name, T::class.java)
        } else {
            intent.getParcelableArrayListExtra(name)
        }
    }
}
