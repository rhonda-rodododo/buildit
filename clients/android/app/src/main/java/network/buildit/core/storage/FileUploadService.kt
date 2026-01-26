package network.buildit.core.storage

import android.content.Context
import android.net.Uri
import android.webkit.MimeTypeMap
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Service for uploading files to file hosting services.
 *
 * Supports multiple backends:
 * - nostr.build (default)
 * - void.cat
 * - Custom file hosts
 *
 * Files are uploaded with proper MIME types and the returned URLs
 * can be used in Nostr messages.
 */
@Singleton
class FileUploadService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val okHttpClient: OkHttpClient
) {
    /**
     * Uploads a file to the configured file host.
     *
     * @param localPath Local file path to upload
     * @param mimeType MIME type of the file
     * @return Result containing the remote URL on success
     */
    suspend fun uploadFile(
        localPath: String,
        mimeType: String
    ): Result<UploadResult> = withContext(Dispatchers.IO) {
        try {
            val file = File(localPath)
            if (!file.exists()) {
                return@withContext Result.failure(IllegalArgumentException("File not found: $localPath"))
            }

            // Try nostr.build first
            uploadToNostrBuild(file, mimeType)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Uploads a file from a content URI.
     *
     * @param uri Content URI of the file
     * @param mimeType MIME type of the file
     * @return Result containing the remote URL on success
     */
    suspend fun uploadFromUri(
        uri: Uri,
        mimeType: String
    ): Result<UploadResult> = withContext(Dispatchers.IO) {
        try {
            // Copy URI content to a temp file
            val tempFile = copyUriToTempFile(uri, mimeType)
            val result = uploadFile(tempFile.absolutePath, mimeType)

            // Clean up temp file
            tempFile.delete()

            result
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Uploads a file to nostr.build.
     */
    private suspend fun uploadToNostrBuild(
        file: File,
        mimeType: String
    ): Result<UploadResult> = withContext(Dispatchers.IO) {
        try {
            val mediaType = mimeType.toMediaType()
            val requestBody = file.asRequestBody(mediaType)

            val multipartBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", file.name, requestBody)
                .build()

            val request = Request.Builder()
                .url(NOSTR_BUILD_UPLOAD_URL)
                .post(multipartBody)
                .build()

            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                return@withContext Result.failure(
                    Exception("Upload failed with status ${response.code}")
                )
            }

            val responseBody = response.body?.string()
                ?: return@withContext Result.failure(Exception("Empty response"))

            // Parse nostr.build response
            val json = JSONObject(responseBody)
            val status = json.optString("status")

            if (status == "success") {
                val data = json.getJSONArray("data").getJSONObject(0)
                val url = data.getString("url")
                val dimensions = data.optJSONObject("dimensions")

                Result.success(UploadResult(
                    url = url,
                    width = dimensions?.optInt("width"),
                    height = dimensions?.optInt("height"),
                    mimeType = mimeType,
                    fileSize = file.length()
                ))
            } else {
                val message = json.optString("message", "Unknown error")
                Result.failure(Exception("Upload failed: $message"))
            }
        } catch (e: Exception) {
            // Fallback to void.cat if nostr.build fails
            uploadToVoidCat(file, mimeType)
        }
    }

    /**
     * Uploads a file to void.cat as fallback.
     */
    private suspend fun uploadToVoidCat(
        file: File,
        mimeType: String
    ): Result<UploadResult> = withContext(Dispatchers.IO) {
        try {
            val mediaType = mimeType.toMediaType()
            val requestBody = file.asRequestBody(mediaType)

            val request = Request.Builder()
                .url(VOID_CAT_UPLOAD_URL)
                .put(requestBody)
                .header("V-Content-Type", mimeType)
                .header("V-Filename", file.name)
                .build()

            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                return@withContext Result.failure(
                    Exception("Upload failed with status ${response.code}")
                )
            }

            val responseBody = response.body?.string()
                ?: return@withContext Result.failure(Exception("Empty response"))

            // Parse void.cat response
            val json = JSONObject(responseBody)
            val fileId = json.getString("id")
            val url = "$VOID_CAT_BASE_URL/$fileId"

            Result.success(UploadResult(
                url = url,
                mimeType = mimeType,
                fileSize = file.length()
            ))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Copies content from a URI to a temporary file.
     */
    private fun copyUriToTempFile(uri: Uri, mimeType: String): File {
        val extension = MimeTypeMap.getSingleton()
            .getExtensionFromMimeType(mimeType) ?: "tmp"

        val tempFile = File(context.cacheDir, "${UUID.randomUUID()}.$extension")

        context.contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(tempFile).use { output ->
                input.copyTo(output)
            }
        }

        return tempFile
    }

    companion object {
        private const val NOSTR_BUILD_UPLOAD_URL = "https://nostr.build/api/v2/upload/files"
        private const val VOID_CAT_UPLOAD_URL = "https://void.cat/upload"
        private const val VOID_CAT_BASE_URL = "https://void.cat/d"
    }
}

/**
 * Result of a successful file upload.
 */
data class UploadResult(
    val url: String,
    val width: Int? = null,
    val height: Int? = null,
    val mimeType: String,
    val fileSize: Long
)
