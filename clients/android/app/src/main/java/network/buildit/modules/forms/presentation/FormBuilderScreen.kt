package network.buildit.modules.forms.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ShortText
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PinDrop
import androidx.compose.material.icons.filled.RadioButtonChecked
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Subject
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import network.buildit.modules.forms.data.local.FieldOption
import network.buildit.modules.forms.data.local.FormField
import network.buildit.modules.forms.data.local.FormFieldType
import network.buildit.modules.forms.data.local.FormVisibility

/**
 * Form builder screen for creating and editing forms.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormBuilderScreen(
    groupId: String?,
    onNavigateBack: () -> Unit,
    onFormCreated: (String) -> Unit,
    viewModel: FormBuilderViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    var showAddFieldSheet by remember { mutableStateOf(false) }
    var showSettingsSheet by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    LaunchedEffect(uiState.isComplete, uiState.createdFormId) {
        if (uiState.isComplete && uiState.createdFormId != null) {
            onFormCreated(uiState.createdFormId!!)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Create Form") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    TextButton(
                        onClick = { showSettingsSheet = true }
                    ) {
                        Text("Settings")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Form content - scrollable
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Title and description
                item {
                    OutlinedTextField(
                        value = uiState.title,
                        onValueChange = { viewModel.updateTitle(it) },
                        label = { Text("Form Title *") },
                        placeholder = { Text("Enter form title") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    OutlinedTextField(
                        value = uiState.description,
                        onValueChange = { viewModel.updateDescription(it) },
                        label = { Text("Description") },
                        placeholder = { Text("Add a description (optional)") },
                        minLines = 2,
                        maxLines = 4,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Questions",
                        style = MaterialTheme.typography.titleMedium
                    )
                }

                // Fields
                if (uiState.fields.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = "No questions added yet",
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Tap the button below to add your first question",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                } else {
                    itemsIndexed(uiState.fields, key = { _, field -> field.id }) { index, field ->
                        FieldEditorCard(
                            field = field,
                            isEditing = uiState.editingFieldIndex == index,
                            onEdit = { viewModel.setEditingField(if (uiState.editingFieldIndex == index) null else index) },
                            onUpdate = { viewModel.updateField(index, it) },
                            onDelete = { viewModel.removeField(index) },
                            onDuplicate = { viewModel.duplicateField(index) }
                        )
                    }
                }

                // Add field button
                item {
                    OutlinedButton(
                        onClick = { showAddFieldSheet = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Add Question")
                    }
                }
            }

            // Bottom action buttons
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { viewModel.saveDraft(groupId) },
                    enabled = !uiState.isSubmitting && uiState.title.isNotBlank(),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Save Draft")
                }

                Button(
                    onClick = { viewModel.publish(groupId) },
                    enabled = !uiState.isSubmitting && viewModel.isValid(),
                    modifier = Modifier.weight(1f)
                ) {
                    if (uiState.isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text("Publish")
                }
            }
        }
    }

    // Add field bottom sheet
    if (showAddFieldSheet) {
        ModalBottomSheet(
            onDismissRequest = { showAddFieldSheet = false },
            sheetState = rememberModalBottomSheetState()
        ) {
            AddFieldSheet(
                onFieldTypeSelected = { fieldType ->
                    viewModel.addField(fieldType)
                    showAddFieldSheet = false
                }
            )
        }
    }

    // Settings bottom sheet
    if (showSettingsSheet) {
        ModalBottomSheet(
            onDismissRequest = { showSettingsSheet = false },
            sheetState = rememberModalBottomSheetState()
        ) {
            FormSettingsSheet(
                visibility = uiState.visibility,
                anonymous = uiState.anonymous,
                allowMultiple = uiState.allowMultiple,
                hasClosingDate = uiState.hasClosingDate,
                maxResponses = uiState.maxResponses,
                confirmationMessage = uiState.confirmationMessage,
                onVisibilityChange = { viewModel.updateVisibility(it) },
                onAnonymousChange = { viewModel.updateAnonymous(it) },
                onAllowMultipleChange = { viewModel.updateAllowMultiple(it) },
                onHasClosingDateChange = { viewModel.updateHasClosingDate(it) },
                onMaxResponsesChange = { viewModel.updateMaxResponses(it) },
                onConfirmationMessageChange = { viewModel.updateConfirmationMessage(it) }
            )
        }
    }
}

/**
 * Add field type selection sheet.
 */
@Composable
fun AddFieldSheet(
    onFieldTypeSelected: (FormFieldType) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            text = "Add Question",
            style = MaterialTheme.typography.titleLarge
        )
        Spacer(modifier = Modifier.height(16.dp))

        // Text inputs
        Text(
            text = "Text",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FieldTypeOption(
                icon = Icons.AutoMirrored.Filled.ShortText,
                label = "Short Text",
                onClick = { onFieldTypeSelected(FormFieldType.TEXT) },
                modifier = Modifier.weight(1f)
            )
            FieldTypeOption(
                icon = Icons.Default.Subject,
                label = "Long Text",
                onClick = { onFieldTypeSelected(FormFieldType.TEXTAREA) },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Choice inputs
        Text(
            text = "Choice",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FieldTypeOption(
                icon = Icons.Default.RadioButtonChecked,
                label = "Radio",
                onClick = { onFieldTypeSelected(FormFieldType.RADIO) },
                modifier = Modifier.weight(1f)
            )
            FieldTypeOption(
                icon = Icons.Default.CheckBox,
                label = "Checkbox",
                onClick = { onFieldTypeSelected(FormFieldType.CHECKBOX) },
                modifier = Modifier.weight(1f)
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FieldTypeOption(
                icon = Icons.Default.ExpandMore,
                label = "Dropdown",
                onClick = { onFieldTypeSelected(FormFieldType.SELECT) },
                modifier = Modifier.weight(1f)
            )
            Spacer(modifier = Modifier.weight(1f))
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Special inputs
        Text(
            text = "Special",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FieldTypeOption(
                icon = Icons.Default.Email,
                label = "Email",
                onClick = { onFieldTypeSelected(FormFieldType.EMAIL) },
                modifier = Modifier.weight(1f)
            )
            FieldTypeOption(
                icon = Icons.Default.Phone,
                label = "Phone",
                onClick = { onFieldTypeSelected(FormFieldType.PHONE) },
                modifier = Modifier.weight(1f)
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FieldTypeOption(
                icon = Icons.Default.PinDrop,
                label = "Number",
                onClick = { onFieldTypeSelected(FormFieldType.NUMBER) },
                modifier = Modifier.weight(1f)
            )
            FieldTypeOption(
                icon = Icons.Default.Link,
                label = "URL",
                onClick = { onFieldTypeSelected(FormFieldType.URL) },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Date/Time inputs
        Text(
            text = "Date & Time",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FieldTypeOption(
                icon = Icons.Default.CalendarToday,
                label = "Date",
                onClick = { onFieldTypeSelected(FormFieldType.DATE) },
                modifier = Modifier.weight(1f)
            )
            FieldTypeOption(
                icon = Icons.Default.Schedule,
                label = "Time",
                onClick = { onFieldTypeSelected(FormFieldType.TIME) },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Rating inputs
        Text(
            text = "Rating",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FieldTypeOption(
                icon = Icons.Default.Star,
                label = "Rating",
                onClick = { onFieldTypeSelected(FormFieldType.RATING) },
                modifier = Modifier.weight(1f)
            )
            FieldTypeOption(
                icon = Icons.Default.PinDrop,
                label = "Scale",
                onClick = { onFieldTypeSelected(FormFieldType.SCALE) },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}

/**
 * Field type option button.
 */
@Composable
fun FieldTypeOption(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

/**
 * Field editor card.
 */
@Composable
fun FieldEditorCard(
    field: FormField,
    isEditing: Boolean,
    onEdit: () -> Unit,
    onUpdate: (FormField) -> Unit,
    onDelete: () -> Unit,
    onDuplicate: () -> Unit
) {
    var showDeleteDialog by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onEdit),
        colors = if (isEditing) {
            CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            )
        } else {
            CardDefaults.cardColors()
        }
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = field.type.displayName,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                if (field.required) {
                    Text(
                        text = " *",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
                IconButton(
                    onClick = onDuplicate,
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        Icons.Default.ContentCopy,
                        contentDescription = "Duplicate",
                        modifier = Modifier.size(18.dp)
                    )
                }
                IconButton(
                    onClick = { showDeleteDialog = true },
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "Delete",
                        modifier = Modifier.size(18.dp),
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (isEditing) {
                // Editable state
                OutlinedTextField(
                    value = field.label,
                    onValueChange = { onUpdate(field.copy(label = it)) },
                    label = { Text("Question") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = field.description ?: "",
                    onValueChange = { onUpdate(field.copy(description = it.ifBlank { null })) },
                    label = { Text("Description (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Options for choice fields
                if (field.type in listOf(
                        FormFieldType.SELECT,
                        FormFieldType.MULTISELECT,
                        FormFieldType.RADIO,
                        FormFieldType.CHECKBOX
                    )
                ) {
                    Text(
                        text = "Options",
                        style = MaterialTheme.typography.labelMedium
                    )
                    Spacer(modifier = Modifier.height(4.dp))

                    field.options?.forEachIndexed { index, option ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(vertical = 4.dp)
                        ) {
                            OutlinedTextField(
                                value = option.label,
                                onValueChange = { newLabel ->
                                    val newOptions = field.options!!.toMutableList()
                                    newOptions[index] = option.copy(label = newLabel)
                                    onUpdate(field.copy(options = newOptions))
                                },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            if ((field.options?.size ?: 0) > 2) {
                                IconButton(
                                    onClick = {
                                        val newOptions = field.options!!.toMutableList()
                                        newOptions.removeAt(index)
                                        onUpdate(field.copy(options = newOptions))
                                    }
                                ) {
                                    Icon(
                                        Icons.Default.Delete,
                                        contentDescription = "Remove option",
                                        tint = MaterialTheme.colorScheme.error
                                    )
                                }
                            }
                        }
                    }

                    TextButton(
                        onClick = {
                            val newOptions = (field.options ?: emptyList()).toMutableList()
                            newOptions.add(
                                FieldOption(
                                    value = "option_${newOptions.size + 1}",
                                    label = "Option ${newOptions.size + 1}"
                                )
                            )
                            onUpdate(field.copy(options = newOptions))
                        }
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Add Option")
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = field.required,
                        onCheckedChange = { onUpdate(field.copy(required = it)) }
                    )
                    Text("Required")
                }
            } else {
                // Collapsed state
                Text(
                    text = field.label,
                    style = MaterialTheme.typography.bodyLarge
                )

                field.description?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (field.options != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "${field.options.size} options",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete Question") },
            text = { Text("Are you sure you want to delete this question?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        onDelete()
                        showDeleteDialog = false
                    }
                ) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

/**
 * Form settings sheet.
 */
@Composable
fun FormSettingsSheet(
    visibility: FormVisibility,
    anonymous: Boolean,
    allowMultiple: Boolean,
    hasClosingDate: Boolean,
    maxResponses: Int?,
    confirmationMessage: String,
    onVisibilityChange: (FormVisibility) -> Unit,
    onAnonymousChange: (Boolean) -> Unit,
    onAllowMultipleChange: (Boolean) -> Unit,
    onHasClosingDateChange: (Boolean) -> Unit,
    onMaxResponsesChange: (Int?) -> Unit,
    onConfirmationMessageChange: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            text = "Form Settings",
            style = MaterialTheme.typography.titleLarge
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Visibility
        Text(
            text = "Visibility",
            style = MaterialTheme.typography.labelLarge
        )
        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FormVisibility.entries.forEach { vis ->
                FilterChip(
                    selected = visibility == vis,
                    onClick = { onVisibilityChange(vis) },
                    label = { Text(vis.displayName) }
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Anonymous responses
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Anonymous Responses",
                    style = MaterialTheme.typography.bodyLarge
                )
                Text(
                    text = "Don't collect respondent identity",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Switch(
                checked = anonymous,
                onCheckedChange = onAnonymousChange
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Allow multiple responses
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Allow Multiple Responses",
                    style = MaterialTheme.typography.bodyLarge
                )
                Text(
                    text = "Users can submit more than once",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Switch(
                checked = allowMultiple,
                onCheckedChange = onAllowMultipleChange
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Closing date
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Set Closing Date",
                    style = MaterialTheme.typography.bodyLarge
                )
                Text(
                    text = "Automatically close form at a specific time",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Switch(
                checked = hasClosingDate,
                onCheckedChange = onHasClosingDateChange
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Max responses
        OutlinedTextField(
            value = maxResponses?.toString() ?: "",
            onValueChange = { onMaxResponsesChange(it.toIntOrNull()) },
            label = { Text("Maximum Responses (optional)") },
            placeholder = { Text("Unlimited") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Confirmation message
        OutlinedTextField(
            value = confirmationMessage,
            onValueChange = onConfirmationMessageChange,
            label = { Text("Confirmation Message") },
            placeholder = { Text("Thank you for your response!") },
            minLines = 2,
            maxLines = 3,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(32.dp))
    }
}
