package network.buildit.modules.calling.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import network.buildit.modules.calling.services.LocalCreditBalance
import network.buildit.modules.calling.services.OutboundCallOptions
import network.buildit.modules.calling.services.PSTNCallManager
import network.buildit.modules.calling.services.PSTNCreditsManager
import javax.inject.Inject

/**
 * Hotline option for dropdown
 */
data class HotlineOption(
    val id: String,
    val name: String,
    val phoneNumber: String? = null
)

/**
 * Outbound Dialer Screen
 *
 * Phone dialer UI for making outbound PSTN calls through hotlines.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OutboundDialerScreen(
    hotlines: List<HotlineOption>,
    viewModel: OutboundDialerViewModel = hiltViewModel(),
    onCallStarted: (String) -> Unit = {},
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val haptic = LocalHapticFeedback.current

    LaunchedEffect(hotlines) {
        if (hotlines.isNotEmpty() && uiState.selectedHotline == null) {
            viewModel.selectHotline(hotlines.first())
        }
    }

    // Load credit balance for selected hotline
    LaunchedEffect(uiState.selectedHotline) {
        uiState.selectedHotline?.let { hotline ->
            viewModel.loadCreditBalance(hotline.id)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Make Call") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        floatingActionButton = {
            // Call FAB
            FloatingActionButton(
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    viewModel.makeCall { callSid ->
                        onCallStarted(callSid)
                    }
                },
                containerColor = Color(0xFF4CAF50), // Green
                contentColor = Color.White,
                modifier = Modifier.size(72.dp)
            ) {
                if (uiState.isDialing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(32.dp),
                        color = Color.White,
                        strokeWidth = 3.dp
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Phone,
                        contentDescription = "Call",
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
        },
        floatingActionButtonPosition = FabPosition.Center
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Credit balance indicator
            CreditBalanceIndicator(
                balance = uiState.creditBalance,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp)
            )

            // Hotline selector
            HotlineSelector(
                hotlines = hotlines,
                selectedHotline = uiState.selectedHotline,
                onHotlineSelected = { viewModel.selectHotline(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Phone number display
            PhoneNumberDisplay(
                phoneNumber = uiState.phoneNumber,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Phone number input (optional for manual entry)
            OutlinedTextField(
                value = uiState.phoneNumber,
                onValueChange = { viewModel.setPhoneNumber(it) },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("+1 (___) ___-____") },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Phone,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        if (uiState.isValidPhoneNumber) {
                            viewModel.makeCall { onCallStarted(it) }
                        }
                    }
                ),
                singleLine = true,
                leadingIcon = {
                    Icon(Icons.Default.Phone, contentDescription = null)
                },
                trailingIcon = {
                    if (uiState.phoneNumber.isNotEmpty()) {
                        IconButton(onClick = { viewModel.clearPhoneNumber() }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear")
                        }
                    }
                },
                isError = uiState.phoneNumber.isNotEmpty() && !uiState.isValidPhoneNumber
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Numpad
            Numpad(
                onDigitPressed = { digit ->
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    viewModel.appendDigit(digit)
                },
                onBackspacePressed = {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    viewModel.deleteLastDigit()
                },
                onBackspaceLongPressed = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    viewModel.clearPhoneNumber()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            )

            // Error message
            uiState.errorMessage?.let { error ->
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = error,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Spacer(modifier = Modifier.height(100.dp)) // Space for FAB
        }
    }
}

/**
 * Credit balance indicator
 */
@Composable
private fun CreditBalanceIndicator(
    balance: LocalCreditBalance?,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = balance?.let {
                when {
                    it.percentUsed >= 95 -> MaterialTheme.colorScheme.errorContainer
                    it.percentUsed >= 80 -> Color(0xFFFFF3E0) // Light orange
                    else -> MaterialTheme.colorScheme.primaryContainer
                }
            } ?: MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.CreditCard,
                contentDescription = null,
                tint = balance?.let {
                    PSTNCreditsManager.getStatusColor(it.percentUsed)
                } ?: MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )

            Spacer(modifier = Modifier.width(8.dp))

            if (balance != null) {
                Text(
                    text = "${PSTNCreditsManager.formatCredits(balance.remaining)} remaining",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )

                Spacer(modifier = Modifier.weight(1f))

                Text(
                    text = "${balance.percentUsed.toInt()}% used",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                Text(
                    text = "Loading credits...",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Hotline selector dropdown
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HotlineSelector(
    hotlines: List<HotlineOption>,
    selectedHotline: HotlineOption?,
    onHotlineSelected: (HotlineOption) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = selectedHotline?.name ?: "Select Hotline",
            onValueChange = {},
            readOnly = true,
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            label = { Text("Calling From") },
            leadingIcon = {
                Icon(Icons.Default.SupportAgent, contentDescription = null)
            },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            hotlines.forEach { hotline ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(
                                text = hotline.name,
                                fontWeight = FontWeight.Medium
                            )
                            hotline.phoneNumber?.let { phone ->
                                Text(
                                    text = phone,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    },
                    onClick = {
                        onHotlineSelected(hotline)
                        expanded = false
                    },
                    leadingIcon = {
                        Icon(Icons.Default.Phone, contentDescription = null)
                    }
                )
            }
        }
    }
}

/**
 * Phone number display (large format)
 */
@Composable
private fun PhoneNumberDisplay(
    phoneNumber: String,
    modifier: Modifier = Modifier
) {
    Text(
        text = formatPhoneNumber(phoneNumber).ifEmpty { "+1 (___) ___-____" },
        style = MaterialTheme.typography.headlineMedium,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
        color = if (phoneNumber.isEmpty())
            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        else
            MaterialTheme.colorScheme.onSurface,
        modifier = modifier.padding(vertical = 8.dp)
    )
}

/**
 * Format phone number for display
 */
private fun formatPhoneNumber(raw: String): String {
    val digits = raw.filter { it.isDigit() }

    return when {
        digits.isEmpty() -> ""
        digits.length <= 1 -> "+$digits"
        digits.length <= 4 -> "+${digits.take(1)} (${digits.drop(1)}"
        digits.length <= 7 -> "+${digits.take(1)} (${digits.substring(1, 4)}) ${digits.drop(4)}"
        digits.length <= 11 -> {
            val country = digits.take(1)
            val area = digits.substring(1, 4)
            val prefix = digits.substring(4, 7)
            val line = digits.drop(7)
            "+$country ($area) $prefix-$line"
        }
        else -> {
            // International format
            "+${digits.take(1)} ${digits.drop(1).chunked(3).joinToString(" ")}"
        }
    }
}

/**
 * Numpad grid
 */
@Composable
private fun Numpad(
    onDigitPressed: (String) -> Unit,
    onBackspacePressed: () -> Unit,
    onBackspaceLongPressed: () -> Unit,
    modifier: Modifier = Modifier
) {
    val keys = listOf(
        "1", "2", "3",
        "4", "5", "6",
        "7", "8", "9",
        "*", "0", "#"
    )

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(keys) { key ->
                NumpadKey(
                    key = key,
                    subtitle = getKeySubtitle(key),
                    onClick = { onDigitPressed(key) }
                )
            }
        }

        // Backspace row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            NumpadKey(
                key = "",
                icon = Icons.Default.Backspace,
                onClick = onBackspacePressed,
                onLongClick = onBackspaceLongPressed
            )
        }
    }
}

/**
 * Get subtitle for numpad key
 */
private fun getKeySubtitle(key: String): String? {
    return when (key) {
        "1" -> null
        "2" -> "ABC"
        "3" -> "DEF"
        "4" -> "GHI"
        "5" -> "JKL"
        "6" -> "MNO"
        "7" -> "PQRS"
        "8" -> "TUV"
        "9" -> "WXYZ"
        "0" -> "+"
        "*" -> null
        "#" -> null
        else -> null
    }
}

/**
 * Individual numpad key
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun NumpadKey(
    key: String,
    subtitle: String? = null,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)? = null
) {
    Surface(
        modifier = Modifier
            .aspectRatio(1.5f)
            .clip(CircleShape)
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = "Backspace",
                    modifier = Modifier.size(24.dp)
                )
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = key,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Medium
                    )
                    if (subtitle != null) {
                        Text(
                            text = subtitle,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            letterSpacing = 2.sp
                        )
                    }
                }
            }
        }
    }
}

/**
 * Outbound Dialer UI State
 */
data class OutboundDialerUiState(
    val phoneNumber: String = "",
    val selectedHotline: HotlineOption? = null,
    val creditBalance: LocalCreditBalance? = null,
    val isDialing: Boolean = false,
    val isValidPhoneNumber: Boolean = false,
    val errorMessage: String? = null
)

/**
 * Outbound Dialer ViewModel
 */
@HiltViewModel
class OutboundDialerViewModel @Inject constructor(
    private val pstnCallManager: PSTNCallManager,
    private val creditsManager: PSTNCreditsManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(OutboundDialerUiState())
    val uiState: StateFlow<OutboundDialerUiState> = _uiState.asStateFlow()

    fun setPhoneNumber(number: String) {
        val filtered = number.filter { it.isDigit() || it == '+' }
        _uiState.value = _uiState.value.copy(
            phoneNumber = filtered,
            isValidPhoneNumber = isValidPhoneNumber(filtered),
            errorMessage = null
        )
    }

    fun appendDigit(digit: String) {
        val current = _uiState.value.phoneNumber
        if (current.length < 15) { // Max phone number length
            val newNumber = current + digit
            _uiState.value = _uiState.value.copy(
                phoneNumber = newNumber,
                isValidPhoneNumber = isValidPhoneNumber(newNumber),
                errorMessage = null
            )
        }
    }

    fun deleteLastDigit() {
        val current = _uiState.value.phoneNumber
        if (current.isNotEmpty()) {
            val newNumber = current.dropLast(1)
            _uiState.value = _uiState.value.copy(
                phoneNumber = newNumber,
                isValidPhoneNumber = isValidPhoneNumber(newNumber),
                errorMessage = null
            )
        }
    }

    fun clearPhoneNumber() {
        _uiState.value = _uiState.value.copy(
            phoneNumber = "",
            isValidPhoneNumber = false,
            errorMessage = null
        )
    }

    fun selectHotline(hotline: HotlineOption) {
        _uiState.value = _uiState.value.copy(
            selectedHotline = hotline,
            errorMessage = null
        )
    }

    fun loadCreditBalance(groupId: String) {
        viewModelScope.launch {
            try {
                val balance = creditsManager.getBalance(groupId)
                _uiState.value = _uiState.value.copy(creditBalance = balance)
            } catch (e: Exception) {
                // Non-fatal - just don't show balance
            }
        }
    }

    fun makeCall(onSuccess: (String) -> Unit) {
        val state = _uiState.value
        val hotline = state.selectedHotline

        if (hotline == null) {
            _uiState.value = state.copy(errorMessage = "Please select a hotline")
            return
        }

        if (!state.isValidPhoneNumber) {
            _uiState.value = state.copy(errorMessage = "Please enter a valid phone number")
            return
        }

        // Check credits
        val balance = state.creditBalance
        if (balance != null && balance.remaining <= 0) {
            _uiState.value = state.copy(errorMessage = "Insufficient credits")
            return
        }

        _uiState.value = state.copy(isDialing = true, errorMessage = null)

        viewModelScope.launch {
            try {
                val callSid = pstnCallManager.dialOutbound(
                    OutboundCallOptions(
                        targetPhone = formatE164(state.phoneNumber),
                        hotlineId = hotline.id
                    )
                )

                _uiState.value = _uiState.value.copy(isDialing = false)
                onSuccess(callSid)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isDialing = false,
                    errorMessage = e.message ?: "Failed to place call"
                )
            }
        }
    }

    private fun isValidPhoneNumber(number: String): Boolean {
        val digits = number.filter { it.isDigit() }
        // Basic validation: US numbers are 11 digits with country code
        return digits.length >= 10 && digits.length <= 15
    }

    private fun formatE164(number: String): String {
        val digits = number.filter { it.isDigit() }

        // Assume US if no country code
        return if (digits.length == 10) {
            "+1$digits"
        } else if (digits.startsWith("1") && digits.length == 11) {
            "+$digits"
        } else {
            "+$digits"
        }
    }
}
