package network.buildit.modules.content.services

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.withContext
import network.buildit.generated.schemas.content.FetchedBy
import network.buildit.generated.schemas.content.LinkPreview
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Signal-style privacy-preserving link preview service.
 *
 * Sender fetches OG metadata + compressed thumbnails via our API proxy,
 * encodes as base64, encrypts with content. Recipients see static previews —
 * zero third-party requests.
 *
 * Uses the shared BuildIt API Worker endpoints:
 * - /api/link-preview — OG metadata
 * - /api/image-proxy — Image proxying for CORS/security
 */
@Singleton
class LinkPreviewService @Inject constructor() {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val apiBaseUrl: String
        get() = System.getenv("API_URL")
            ?: "https://buildit-api.rikki-schulte.workers.dev"

    private val cache = mutableMapOf<String, CachedPreview>()
    private val cacheTtlMs = 15 * 60 * 1000L // 15 minutes
    private val maxCacheSize = 100

    // MARK: - Public API

    /**
     * Generate a link preview for a single URL.
     */
    suspend fun generatePreview(
        url: String,
        options: LinkPreviewOptions = LinkPreviewOptions()
    ): LinkPreview? = withContext(Dispatchers.IO) {
        if (!isSecureUrl(url)) return@withContext null

        val normalized = normalizeUrl(url)

        // Check cache
        cache[normalized]?.let { cached ->
            if (System.currentTimeMillis() - cached.cachedAt < cacheTtlMs) {
                return@withContext cached.preview
            } else {
                cache.remove(normalized)
            }
        }

        try {
            val ogData = fetchOpenGraphData(url)

            var imageData: String? = null
            var imageType: String? = null
            var imageWidth: Long? = null
            var imageHeight: Long? = null
            var faviconData: String? = null
            var faviconType: String? = null

            // Fetch and compress thumbnail
            ogData.imageUrl?.let { imageUrl ->
                fetchAndCompressImage(imageUrl, options)?.let { image ->
                    imageData = image.data
                    imageType = image.mimeType
                    imageWidth = image.width.toLong()
                    imageHeight = image.height.toLong()
                }
            }

            // Fetch favicon
            if (options.fetchFavicon) {
                ogData.faviconUrl?.let { faviconUrl ->
                    fetchFavicon(faviconUrl)?.let { favicon ->
                        faviconData = favicon.data
                        faviconType = favicon.mimeType
                    }
                }
            }

            val preview = LinkPreview(
                url = url,
                title = ogData.title,
                description = ogData.description?.take(300),
                siteName = ogData.siteName,
                imageData = imageData,
                imageType = imageType,
                imageWidth = imageWidth,
                imageHeight = imageHeight,
                faviconData = faviconData,
                faviconType = faviconType,
                fetchedAt = System.currentTimeMillis() / 1000,
                fetchedBy = FetchedBy.Sender
            )

            storeInCache(normalized, preview)
            preview
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Generate previews for multiple URLs (max 3, HTTPS only, deduplicated).
     */
    suspend fun generatePreviews(
        urls: List<String>,
        options: LinkPreviewOptions = LinkPreviewOptions()
    ): List<LinkPreview> = withContext(Dispatchers.IO) {
        val uniqueUrls = urls
            .filter { isSecureUrl(it) }
            .distinct()
            .take(3)

        uniqueUrls.map { url ->
            async { generatePreview(url, options) }
        }.awaitAll().filterNotNull()
    }

    /** Clear the entire cache. */
    fun clearCache() {
        cache.clear()
    }

    // MARK: - URL Utilities

    companion object {
        private val urlRegex = Regex(
            """https://[^\s<>"{}|\\^`\[\]]+""",
            RegexOption.IGNORE_CASE
        )

        /** Extract HTTPS URLs from text content. */
        fun extractUrls(text: String): List<String> {
            return urlRegex.findAll(text)
                .map { it.value.trimEnd('.', ',', ')', ']', ';', '!', '?') }
                .filter { isSecureUrlStatic(it) }
                .distinct()
                .toList()
        }

        private fun isSecureUrlStatic(url: String): Boolean {
            return try {
                val parsed = URL(url)
                parsed.protocol == "https"
            } catch (e: Exception) {
                false
            }
        }
    }

    // MARK: - Private Helpers

    private fun isSecureUrl(url: String): Boolean = isSecureUrlStatic(url)

    private fun normalizeUrl(url: String): String {
        val trackingParams = setOf(
            "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
            "ref", "fbclid", "gclid"
        )
        return try {
            val parsed = URL(url)
            val cleanQuery = parsed.query?.split("&")
                ?.filter { param ->
                    val key = param.substringBefore("=").lowercase()
                    key !in trackingParams
                }
                ?.joinToString("&")

            val base = "${parsed.protocol}://${parsed.host}${parsed.path}"
            if (cleanQuery.isNullOrEmpty()) base else "$base?$cleanQuery"
        } catch (e: Exception) {
            url
        }
    }

    private fun storeInCache(url: String, preview: LinkPreview) {
        cache[url] = CachedPreview(preview, System.currentTimeMillis())
        if (cache.size > maxCacheSize) {
            val oldest = cache.entries.minByOrNull { it.value.cachedAt }
            oldest?.let { cache.remove(it.key) }
        }
    }

    // MARK: - Network Calls

    private fun fetchOpenGraphData(url: String): OpenGraphData {
        val encoded = URLEncoder.encode(url, "UTF-8")
        val request = Request.Builder()
            .url("$apiBaseUrl/api/link-preview?url=$encoded")
            .header("Accept", "application/json")
            .get()
            .build()

        val response = httpClient.newCall(request).execute()
        if (!response.isSuccessful) throw Exception("HTTP ${response.code}")

        val body = response.body?.string() ?: throw Exception("Empty response")
        val json = JSONObject(body)

        if (!json.optBoolean("success", false)) {
            throw Exception(json.optString("error", "Failed to fetch preview"))
        }

        val data = json.optJSONObject("data") ?: throw Exception("No data")

        return OpenGraphData(
            title = data.optString("title").takeIf { it.isNotEmpty() },
            description = data.optString("description").takeIf { it.isNotEmpty() },
            imageUrl = data.optString("imageUrl").takeIf { it.isNotEmpty() },
            siteName = data.optString("siteName").takeIf { it.isNotEmpty() },
            faviconUrl = data.optString("faviconUrl").takeIf { it.isNotEmpty() }
        )
    }

    private fun fetchAndCompressImage(
        imageUrl: String,
        options: LinkPreviewOptions
    ): CompressedImage? {
        if (!isSecureUrl(imageUrl)) return null

        return try {
            val encoded = URLEncoder.encode(imageUrl, "UTF-8")
            val request = Request.Builder()
                .url("$apiBaseUrl/api/image-proxy?url=$encoded")
                .get()
                .build()

            val response = httpClient.newCall(request).execute()
            if (!response.isSuccessful) return null

            val contentType = response.header("Content-Type") ?: return null
            if (!contentType.startsWith("image/")) return null

            val bytes = response.body?.bytes() ?: return null
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null

            // Scale down if needed
            var width = bitmap.width
            var height = bitmap.height

            if (width > options.maxWidth || height > options.maxHeight) {
                val widthRatio = options.maxWidth.toFloat() / width
                val heightRatio = options.maxHeight.toFloat() / height
                val ratio = minOf(widthRatio, heightRatio)
                width = (width * ratio).toInt()
                height = (height * ratio).toInt()
            }

            val scaled = Bitmap.createScaledBitmap(bitmap, width, height, true)

            // Compress to JPEG, reducing quality until under maxBytes
            var quality = options.imageQuality
            var output: ByteArray

            do {
                val stream = ByteArrayOutputStream()
                scaled.compress(Bitmap.CompressFormat.JPEG, quality, stream)
                output = stream.toByteArray()
                quality -= 10
            } while (output.size > options.maxImageBytes && quality > 30)

            if (bitmap != scaled) bitmap.recycle()
            scaled.recycle()

            CompressedImage(
                data = Base64.encodeToString(output, Base64.NO_WRAP),
                mimeType = "image/jpeg",
                width = width,
                height = height
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun fetchFavicon(faviconUrl: String): FaviconData? {
        if (!isSecureUrl(faviconUrl)) return null

        return try {
            val encoded = URLEncoder.encode(faviconUrl, "UTF-8")
            val request = Request.Builder()
                .url("$apiBaseUrl/api/image-proxy?url=$encoded")
                .get()
                .build()

            val response = httpClient.newCall(request).execute()
            if (!response.isSuccessful) return null

            val contentType = response.header("Content-Type") ?: return null
            if (!contentType.startsWith("image/")) return null

            val bytes = response.body?.bytes() ?: return null
            if (bytes.size > 10 * 1024) return null // Max 10KB

            FaviconData(
                data = Base64.encodeToString(bytes, Base64.NO_WRAP),
                mimeType = contentType
            )
        } catch (e: Exception) {
            null
        }
    }
}

/** Options for generating link previews. */
data class LinkPreviewOptions(
    val maxWidth: Int = 400,
    val maxHeight: Int = 400,
    val maxImageBytes: Int = 50_000,
    val imageQuality: Int = 80,
    val fetchFavicon: Boolean = true
)

private data class OpenGraphData(
    val title: String?,
    val description: String?,
    val imageUrl: String?,
    val siteName: String?,
    val faviconUrl: String?
)

private data class CompressedImage(
    val data: String, // base64
    val mimeType: String,
    val width: Int,
    val height: Int
)

private data class FaviconData(
    val data: String, // base64
    val mimeType: String
)

private data class CachedPreview(
    val preview: LinkPreview,
    val cachedAt: Long
)
