package network.buildit.modules.forms.presentation

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.util.Locale
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Location precision levels for privacy-preserving location sharing.
 * "NEIGHBORHOOD" is the default - exact is opt-in with a privacy warning.
 */
enum class LocationPrecision(val displayName: String, val offsetDegrees: Double) {
    EXACT("Exact address (least private)", 0.0),
    NEIGHBORHOOD("Neighborhood area (~500m)", 0.005),
    CITY("City area (~5km)", 0.05),
    REGION("Regional area (~50km)", 0.5)
}

/**
 * Structured location value stored by location fields.
 */
@Serializable
data class LocationValue(
    val lat: Double,
    val lng: Double,
    val label: String,
    val precision: String = "neighborhood"
) {
    /**
     * Get the precision enum value.
     */
    fun getPrecision(): LocationPrecision {
        return try {
            LocationPrecision.valueOf(precision.uppercase())
        } catch (_: IllegalArgumentException) {
            LocationPrecision.NEIGHBORHOOD
        }
    }

    /**
     * Build an OpenStreetMap URL.
     */
    fun openStreetMapUrl(): String {
        return "https://www.openstreetmap.org/?mlat=$lat&mlon=$lng#map=15/$lat/$lng"
    }
}

/**
 * Calculate haversine distance between two points in kilometers.
 */
fun haversineDistance(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val r = 6371.0 // Earth radius in km
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
            sin(dLng / 2) * sin(dLng / 2)
    val c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c
}

/**
 * Location field input composable with search, GPS, and precision controls.
 *
 * Uses OSM Nominatim for geocoding (NOT Google Geocoding).
 * Uses FusedLocationProviderClient for GPS access.
 *
 * PRIVACY: Neighborhood precision is the default. Exact location
 * requires opt-in with a clear privacy warning.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationFieldInput(
    label: String,
    value: LocationValue?,
    onValueChange: (LocationValue?) -> Unit,
    isRequired: Boolean = false,
    allowExactLocation: Boolean = false,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf(value?.label ?: "") }
    var searchResults by remember { mutableStateOf<List<GeocodingResult>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }
    var precision by remember { mutableStateOf(value?.getPrecision() ?: LocationPrecision.NEIGHBORHOOD) }
    var showExactWarning by remember { mutableStateOf(false) }
    var isGeolocating by remember { mutableStateOf(false) }
    var precisionExpanded by remember { mutableStateOf(false) }

    // Location permission launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            scope.launch {
                getCurrentLocation(context)?.let { (lat, lng) ->
                    val label = reverseGeocode(context, lat, lng)
                    searchQuery = label
                    onValueChange(LocationValue(lat, lng, label, precision.name.lowercase()))
                }
                isGeolocating = false
            }
        }
        isGeolocating = false
    }

    Column(modifier = modifier.fillMaxWidth()) {
        // Label
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Default.LocationOn,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = label + if (isRequired) " *" else "",
                style = MaterialTheme.typography.labelLarge
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Search input with GPS button
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search for a location...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )

            Spacer(modifier = Modifier.width(8.dp))

            IconButton(
                onClick = {
                    isGeolocating = true
                    if (ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.ACCESS_FINE_LOCATION
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        scope.launch {
                            getCurrentLocation(context)?.let { (lat, lng) ->
                                val geoLabel = reverseGeocode(context, lat, lng)
                                searchQuery = geoLabel
                                onValueChange(
                                    LocationValue(lat, lng, geoLabel, precision.name.lowercase())
                                )
                            }
                            isGeolocating = false
                        }
                    } else {
                        permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                    }
                },
                enabled = !isGeolocating
            ) {
                Icon(Icons.Default.MyLocation, contentDescription = "Use current location")
            }
        }

        // Search button
        Button(
            onClick = {
                if (searchQuery.length >= 3) {
                    isSearching = true
                    scope.launch {
                        searchResults = geocodeWithNominatim(searchQuery)
                        isSearching = false
                    }
                }
            },
            enabled = searchQuery.length >= 3 && !isSearching,
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
        ) {
            Text(if (isSearching) "Searching..." else "Search")
        }

        // Search results
        if (searchResults.isNotEmpty()) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column {
                    searchResults.forEach { result ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    searchQuery = result.label
                                    searchResults = emptyList()
                                    onValueChange(
                                        LocationValue(
                                            result.lat,
                                            result.lng,
                                            result.label,
                                            precision.name.lowercase()
                                        )
                                    )
                                }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.LocationOn,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = result.label,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 2
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Precision selector
        Text(
            text = "Location precision",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        ExposedDropdownMenuBox(
            expanded = precisionExpanded,
            onExpandedChange = { precisionExpanded = it }
        ) {
            OutlinedTextField(
                value = precision.displayName,
                onValueChange = {},
                readOnly = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = precisionExpanded) },
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth()
            )

            ExposedDropdownMenu(
                expanded = precisionExpanded,
                onDismissRequest = { precisionExpanded = false }
            ) {
                val availablePrecisions = if (allowExactLocation) {
                    LocationPrecision.entries
                } else {
                    LocationPrecision.entries.filter { it != LocationPrecision.EXACT }
                }

                availablePrecisions.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option.displayName) },
                        onClick = {
                            precisionExpanded = false
                            if (option == LocationPrecision.EXACT) {
                                showExactWarning = true
                            } else {
                                precision = option
                                value?.let {
                                    onValueChange(it.copy(precision = option.name.lowercase()))
                                }
                            }
                        }
                    )
                }
            }
        }

        // Exact precision warning dialog
        if (showExactWarning) {
            AlertDialog(
                onDismissRequest = { showExactWarning = false },
                icon = {
                    Icon(
                        Icons.Default.Warning,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error
                    )
                },
                title = { Text("Privacy Warning") },
                text = {
                    Text(
                        "Exact location data can identify you. " +
                                "Use neighborhood or city precision for safety."
                    )
                },
                confirmButton = {
                    Button(
                        onClick = {
                            precision = LocationPrecision.EXACT
                            showExactWarning = false
                            value?.let {
                                onValueChange(it.copy(precision = "exact"))
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        Text("Use Exact Location")
                    }
                },
                dismissButton = {
                    OutlinedButton(onClick = { showExactWarning = false }) {
                        Text("Cancel")
                    }
                }
            )
        }

        // Location display
        if (value != null) {
            Spacer(modifier = Modifier.height(8.dp))
            LocationFieldDisplay(
                value = value,
                compact = false
            )
        }
    }
}

/**
 * Read-only location display composable.
 */
@Composable
fun LocationFieldDisplay(
    value: LocationValue,
    compact: Boolean = true,
    modifier: Modifier = Modifier
) {
    val displayLabel = when (value.getPrecision()) {
        LocationPrecision.REGION -> {
            val parts = value.label.split(",").map { it.trim() }
            if (parts.size > 2) parts.takeLast(2).joinToString(", ") else value.label
        }
        LocationPrecision.CITY -> {
            val parts = value.label.split(",").map { it.trim() }
            if (parts.size > 3) parts.takeLast(3).joinToString(", ") else value.label
        }
        else -> value.label
    }

    if (compact) {
        Row(
            modifier = modifier,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.LocationOn,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = displayLabel,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 1
            )
        }
    } else {
        Card(
            modifier = modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Row(verticalAlignment = Alignment.Top) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = displayLabel,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = value.getPrecision().displayName,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Geocoding Helpers

data class GeocodingResult(
    val lat: Double,
    val lng: Double,
    val label: String
)

/**
 * Geocode an address using Nominatim OSM API (NOT Google Geocoding).
 */
private suspend fun geocodeWithNominatim(query: String): List<GeocodingResult> =
    withContext(Dispatchers.IO) {
        try {
            val encodedQuery = java.net.URLEncoder.encode(query, "UTF-8")
            val url = java.net.URL(
                "https://nominatim.openstreetmap.org/search?q=$encodedQuery&format=json&limit=5"
            )
            val connection = url.openConnection().apply {
                setRequestProperty("User-Agent", "BuildIt/1.0 (https://buildit.network)")
                connectTimeout = 10000
                readTimeout = 10000
            }

            val response = connection.getInputStream().bufferedReader().readText()
            val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }

            @Serializable
            data class NominatimResult(
                val lat: String,
                val lon: String,
                val display_name: String
            )

            val results = json.decodeFromString<List<NominatimResult>>(response)
            results.map { GeocodingResult(it.lat.toDouble(), it.lon.toDouble(), it.display_name) }
        } catch (e: Exception) {
            emptyList()
        }
    }

/**
 * Get current GPS location using FusedLocationProviderClient.
 */
@Suppress("MissingPermission")
private suspend fun getCurrentLocation(context: Context): Pair<Double, Double>? =
    withContext(Dispatchers.IO) {
        try {
            val client = LocationServices.getFusedLocationProviderClient(context)
            val location = client.lastLocation.await()
            if (location != null) {
                Pair(location.latitude, location.longitude)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

/**
 * Reverse geocode coordinates to a human-readable label.
 */
private suspend fun reverseGeocode(
    context: Context,
    lat: Double,
    lng: Double
): String = withContext(Dispatchers.IO) {
    try {
        val geocoder = Geocoder(context, Locale.getDefault())
        @Suppress("DEPRECATION")
        val addresses = geocoder.getFromLocation(lat, lng, 1)
        addresses?.firstOrNull()?.let { address ->
            (0..address.maxAddressLineIndex).joinToString(", ") { address.getAddressLine(it) }
        } ?: "${"%.6f".format(lat)}, ${"%.6f".format(lng)}"
    } catch (_: Exception) {
        "${"%.6f".format(lat)}, ${"%.6f".format(lng)}"
    }
}
