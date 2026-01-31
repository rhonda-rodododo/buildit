package network.buildit.modules.forms.presentation

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Poll
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
// MenuAnchorType requires Material3 1.3.0+
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.forms.data.FieldStats
import network.buildit.modules.forms.data.local.FieldOption
import network.buildit.modules.forms.data.local.FormEntity
import network.buildit.modules.forms.data.local.FormField
import network.buildit.modules.forms.data.local.FormFieldType
import network.buildit.modules.forms.data.local.FormResponseEntity
import network.buildit.modules.forms.data.local.FormStatus
import network.buildit.modules.forms.data.local.FormVisibility
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Main forms list screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormsListScreen(
    onNavigateToCreateForm: () -> Unit,
    onNavigateToFormDetail: (String) -> Unit,
    onNavigateToFormResponses: (String) -> Unit,
    viewModel: FormsListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Forms") },
                actions = {
                    IconButton(onClick = onNavigateToCreateForm) {
                        Icon(Icons.Default.Add, contentDescription = "Create Form")
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
            // Tab Row
            TabRow(selectedTabIndex = uiState.selectedTab) {
                Tab(
                    selected = uiState.selectedTab == 0,
                    onClick = { viewModel.selectTab(0) },
                    text = { Text("Open Forms") }
                )
                Tab(
                    selected = uiState.selectedTab == 1,
                    onClick = { viewModel.selectTab(1) },
                    text = { Text("My Forms") }
                )
            }

            // Content
            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else {
                val forms = if (uiState.selectedTab == 0) uiState.forms else uiState.myForms

                if (forms.isEmpty()) {
                    EmptyFormsView(
                        isMyForms = uiState.selectedTab == 1,
                        onCreateForm = onNavigateToCreateForm
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(forms, key = { it.id }) { form ->
                            FormCard(
                                form = form,
                                isOwner = uiState.selectedTab == 1,
                                onClick = {
                                    if (uiState.selectedTab == 1) {
                                        onNavigateToFormResponses(form.id)
                                    } else {
                                        onNavigateToFormDetail(form.id)
                                    }
                                },
                                onDelete = if (uiState.selectedTab == 1) {
                                    { viewModel.deleteForm(form.id) }
                                } else null
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Form card component.
 */
@Composable
fun FormCard(
    form: FormEntity,
    isOwner: Boolean,
    onClick: () -> Unit,
    onDelete: (() -> Unit)?
) {
    var showDeleteDialog by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Assignment,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = form.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                FormStatusChip(status = form.status)
            }

            form.description?.let { description ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = when (form.visibility) {
                        FormVisibility.PRIVATE -> Icons.Default.Lock
                        FormVisibility.GROUP -> Icons.Default.People
                        FormVisibility.PUBLIC -> Icons.Default.Public
                    },
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = form.visibility.displayName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.width(16.dp))

                Text(
                    text = "${form.fields.size} questions",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (isOwner) {
                    Spacer(modifier = Modifier.width(16.dp))
                    Text(
                        text = "${form.responseCount} responses",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.weight(1f))

                if (isOwner && onDelete != null) {
                    IconButton(
                        onClick = { showDeleteDialog = true },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = "Delete",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        }
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete Form") },
            text = { Text("Are you sure you want to delete this form and all its responses?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        onDelete?.invoke()
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
 * Form status chip.
 */
@Composable
fun FormStatusChip(status: FormStatus) {
    val (backgroundColor, textColor) = when (status) {
        FormStatus.DRAFT -> Pair(Color(0xFFE0E0E0), Color(0xFF616161))
        FormStatus.OPEN -> Pair(Color(0xFFE8F5E9), Color(0xFF2E7D32))
        FormStatus.CLOSED -> Pair(Color(0xFFFFEBEE), Color(0xFFC62828))
        FormStatus.ARCHIVED -> Pair(Color(0xFFE0E0E0), Color(0xFF616161))
    }

    Surface(
        shape = MaterialTheme.shapes.small,
        color = backgroundColor
    ) {
        Text(
            text = status.displayName,
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

/**
 * Empty state view for forms list.
 */
@Composable
fun EmptyFormsView(
    isMyForms: Boolean,
    onCreateForm: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Assignment,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = if (isMyForms) "No forms created" else "No open forms",
            style = MaterialTheme.typography.titleMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = if (isMyForms) "Create your first form or survey" else "Forms from your groups will appear here",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        if (isMyForms) {
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = onCreateForm) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Create Form")
            }
        }
    }
}

/**
 * Form detail/fill screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormDetailScreen(
    formId: String,
    onNavigateBack: () -> Unit,
    viewModel: FormDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(formId) {
        viewModel.loadForm(formId)
    }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.form?.title ?: "Form") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            uiState.isComplete -> {
                FormSubmittedView(
                    confirmationMessage = uiState.form?.confirmationMessage,
                    onDone = onNavigateBack
                )
            }

            uiState.hasResponded && uiState.form?.allowMultiple != true -> {
                AlreadyRespondedView(
                    response = uiState.existingResponse,
                    form = uiState.form,
                    onDone = onNavigateBack
                )
            }

            uiState.form != null -> {
                FormFillContent(
                    form = uiState.form!!,
                    visibleFields = uiState.visibleFields,
                    answers = uiState.answers,
                    validationErrors = uiState.validationErrors,
                    isSubmitting = uiState.isSubmitting,
                    onAnswerChange = { fieldId, value ->
                        viewModel.updateAnswer(fieldId, value)
                    },
                    onSubmit = { viewModel.submit() },
                    modifier = Modifier.padding(padding)
                )
            }
        }
    }
}

/**
 * Form fill content.
 */
@Composable
fun FormFillContent(
    form: FormEntity,
    visibleFields: List<FormField>,
    answers: Map<String, String>,
    validationErrors: Map<String, String>,
    isSubmitting: Boolean,
    onAnswerChange: (String, String) -> Unit,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        form.description?.let { description ->
            Text(
                text = description,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(24.dp))
        }

        visibleFields.forEach { field ->
            FormFieldInput(
                field = field,
                value = answers[field.id] ?: "",
                error = validationErrors[field.id],
                onValueChange = { onAnswerChange(field.id, it) }
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onSubmit,
            enabled = !isSubmitting,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (isSubmitting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text("Submit")
        }
    }
}

/**
 * Form field input component.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormFieldInput(
    field: FormField,
    value: String,
    error: String?,
    onValueChange: (String) -> Unit
) {
    Column {
        Row {
            Text(
                text = field.label,
                style = MaterialTheme.typography.bodyLarge
            )
            if (field.required) {
                Text(
                    text = " *",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }

        field.description?.let { description ->
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        when (field.type) {
            FormFieldType.TEXT, FormFieldType.EMAIL, FormFieldType.PHONE, FormFieldType.URL -> {
                OutlinedTextField(
                    value = value,
                    onValueChange = onValueChange,
                    placeholder = field.placeholder?.let { { Text(it) } },
                    isError = error != null,
                    supportingText = error?.let { { Text(it) } },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = when (field.type) {
                            FormFieldType.EMAIL -> KeyboardType.Email
                            FormFieldType.PHONE -> KeyboardType.Phone
                            FormFieldType.URL -> KeyboardType.Uri
                            else -> KeyboardType.Text
                        }
                    ),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            FormFieldType.TEXTAREA -> {
                OutlinedTextField(
                    value = value,
                    onValueChange = onValueChange,
                    placeholder = field.placeholder?.let { { Text(it) } },
                    isError = error != null,
                    supportingText = error?.let { { Text(it) } },
                    minLines = 3,
                    maxLines = 6,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            FormFieldType.NUMBER -> {
                OutlinedTextField(
                    value = value,
                    onValueChange = onValueChange,
                    placeholder = field.placeholder?.let { { Text(it) } },
                    isError = error != null,
                    supportingText = error?.let { { Text(it) } },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            FormFieldType.SELECT -> {
                var expanded by remember { mutableStateOf(false) }
                val selectedOption = field.options?.find { it.value == value }

                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = !expanded }
                ) {
                    OutlinedTextField(
                        value = selectedOption?.label ?: "",
                        onValueChange = {},
                        readOnly = true,
                        placeholder = field.placeholder?.let { { Text(it) } },
                        isError = error != null,
                        supportingText = error?.let { { Text(it) } },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth()
                    )

                    ExposedDropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        field.options?.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option.label) },
                                onClick = {
                                    onValueChange(option.value)
                                    expanded = false
                                }
                            )
                        }
                    }
                }
            }

            FormFieldType.RADIO -> {
                Column {
                    field.options?.forEach { option ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onValueChange(option.value) }
                                .padding(vertical = 4.dp)
                        ) {
                            RadioButton(
                                selected = value == option.value,
                                onClick = { onValueChange(option.value) }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(option.label)
                        }
                    }
                    if (error != null) {
                        Text(
                            text = error,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            FormFieldType.CHECKBOX, FormFieldType.MULTISELECT -> {
                val selectedValues = value.split(",").map { it.trim() }.filter { it.isNotEmpty() }.toSet()

                Column {
                    field.options?.forEach { option ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    val newValues = if (option.value in selectedValues) {
                                        selectedValues - option.value
                                    } else {
                                        selectedValues + option.value
                                    }
                                    onValueChange(newValues.joinToString(","))
                                }
                                .padding(vertical = 4.dp)
                        ) {
                            Checkbox(
                                checked = option.value in selectedValues,
                                onCheckedChange = {
                                    val newValues = if (it) {
                                        selectedValues + option.value
                                    } else {
                                        selectedValues - option.value
                                    }
                                    onValueChange(newValues.joinToString(","))
                                }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(option.label)
                        }
                    }
                    if (error != null) {
                        Text(
                            text = error,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            FormFieldType.RATING -> {
                val rating = value.toIntOrNull() ?: 0
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    (1..5).forEach { star ->
                        IconButton(onClick = { onValueChange(star.toString()) }) {
                            Icon(
                                imageVector = if (star <= rating) Icons.Default.CheckCircle else Icons.Default.Check,
                                contentDescription = "$star stars",
                                tint = if (star <= rating) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                }
                            )
                        }
                    }
                }
                if (error != null) {
                    Text(
                        text = error,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            FormFieldType.SCALE -> {
                val min = field.validation?.min?.toFloat() ?: 1f
                val max = field.validation?.max?.toFloat() ?: 10f
                var sliderValue by remember { mutableFloatStateOf(value.toFloatOrNull() ?: min) }

                Column {
                    Slider(
                        value = sliderValue,
                        onValueChange = { sliderValue = it },
                        onValueChangeFinished = { onValueChange(sliderValue.toInt().toString()) },
                        valueRange = min..max,
                        steps = (max - min).toInt() - 1,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(min.toInt().toString(), style = MaterialTheme.typography.bodySmall)
                        Text(sliderValue.toInt().toString(), style = MaterialTheme.typography.bodyMedium)
                        Text(max.toInt().toString(), style = MaterialTheme.typography.bodySmall)
                    }
                }
                if (error != null) {
                    Text(
                        text = error,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            else -> {
                OutlinedTextField(
                    value = value,
                    onValueChange = onValueChange,
                    placeholder = field.placeholder?.let { { Text(it) } },
                    isError = error != null,
                    supportingText = error?.let { { Text(it) } },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

/**
 * Form submitted success view.
 */
@Composable
fun FormSubmittedView(
    confirmationMessage: String?,
    onDone: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Response Submitted",
            style = MaterialTheme.typography.headlineSmall
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = confirmationMessage ?: "Thank you for your response!",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(32.dp))
        Button(onClick = onDone) {
            Text("Done")
        }
    }
}

/**
 * Already responded view.
 */
@Composable
fun AlreadyRespondedView(
    response: FormResponseEntity?,
    form: FormEntity?,
    onDone: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Check,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Already Submitted",
            style = MaterialTheme.typography.titleLarge
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "You have already submitted a response to this form.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        response?.let {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Submitted ${formatDate(it.submittedAt)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
        OutlinedButton(onClick = onDone) {
            Text("Go Back")
        }
    }
}

/**
 * Form responses screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormResponsesScreen(
    formId: String,
    onNavigateBack: () -> Unit,
    viewModel: FormResponsesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(formId) {
        viewModel.loadForm(formId)
    }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.form?.title ?: "Responses") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (uiState.form?.status == FormStatus.OPEN) {
                        TextButton(onClick = { viewModel.closeForm(formId) }) {
                            Text("Close Form")
                        }
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
            // Tab Row
            TabRow(selectedTabIndex = uiState.selectedTab) {
                Tab(
                    selected = uiState.selectedTab == 0,
                    onClick = { viewModel.selectTab(0) },
                    text = { Text("Responses (${uiState.responses.size})") }
                )
                Tab(
                    selected = uiState.selectedTab == 1,
                    onClick = { viewModel.selectTab(1) },
                    text = { Text("Analytics") }
                )
            }

            when {
                uiState.isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }

                uiState.selectedTab == 0 -> {
                    if (uiState.responses.isEmpty()) {
                        EmptyResponsesView()
                    } else {
                        ResponsesList(
                            responses = uiState.responses,
                            form = uiState.form
                        )
                    }
                }

                uiState.selectedTab == 1 -> {
                    AnalyticsView(
                        analytics = uiState.analytics,
                        form = uiState.form
                    )
                }
            }
        }
    }
}

/**
 * Responses list view.
 */
@Composable
fun ResponsesList(
    responses: List<FormResponseEntity>,
    form: FormEntity?
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(responses, key = { it.id }) { response ->
            ResponseCard(response = response, form = form)
        }
    }
}

/**
 * Response card.
 */
@Composable
fun ResponseCard(
    response: FormResponseEntity,
    form: FormEntity?
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Visibility,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = if (response.respondent != null) {
                        "${response.respondent.take(8)}..."
                    } else {
                        "Anonymous"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = formatDate(response.submittedAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            form?.fields?.forEach { field ->
                val answer = response.answers[field.id]
                if (!answer.isNullOrBlank()) {
                    Row(
                        modifier = Modifier.padding(vertical = 4.dp)
                    ) {
                        Text(
                            text = "${field.label}:",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(0.4f)
                        )
                        Text(
                            text = formatAnswerDisplay(answer, field),
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.weight(0.6f)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Empty responses view.
 */
@Composable
fun EmptyResponsesView() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Poll,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "No responses yet",
            style = MaterialTheme.typography.titleMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Responses will appear here as they come in",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Analytics view.
 */
@Composable
fun AnalyticsView(
    analytics: network.buildit.modules.forms.data.FormAnalytics?,
    form: FormEntity?
) {
    if (analytics == null || form == null) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text("Loading analytics...")
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // Summary card
        Card(
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    text = "Summary",
                    style = MaterialTheme.typography.titleMedium
                )
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    StatItem(label = "Responses", value = analytics.totalResponses.toString())
                    StatItem(label = "Unique", value = analytics.uniqueRespondents.toString())
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Field analytics
        form.fields.forEach { field ->
            val fieldStats = analytics.fieldStats[field.id]

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = field.label,
                        style = MaterialTheme.typography.titleSmall
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    when (fieldStats) {
                        is FieldStats.ChoiceStats -> {
                            field.options?.forEach { option ->
                                val count = fieldStats.optionCounts[option.value] ?: 0
                                val percentage = fieldStats.getPercentage(option.value)

                                Column(modifier = Modifier.padding(vertical = 4.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = option.label,
                                            style = MaterialTheme.typography.bodyMedium
                                        )
                                        Text(
                                            text = "$count (${String.format("%.1f", percentage)}%)",
                                            style = MaterialTheme.typography.bodyMedium
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    LinearProgressIndicator(
                                        progress = { (percentage / 100).toFloat() },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(8.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                    )
                                }
                            }
                        }

                        is FieldStats.NumericStats -> {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                StatItem(
                                    label = "Min",
                                    value = String.format("%.1f", fieldStats.min)
                                )
                                StatItem(
                                    label = "Avg",
                                    value = String.format("%.1f", fieldStats.average)
                                )
                                StatItem(
                                    label = "Max",
                                    value = String.format("%.1f", fieldStats.max)
                                )
                            }
                        }

                        is FieldStats.TextStats -> {
                            Text(
                                text = "${fieldStats.responseCount} text responses",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        else -> {
                            Text(
                                text = "No data",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}

/**
 * Stat item component.
 */
@Composable
fun StatItem(
    label: String,
    value: String
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = value,
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// Utility functions

private fun formatDate(timestamp: Long): String {
    val formatter = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())
    return formatter.format(Date(timestamp))
}

private fun formatAnswerDisplay(answer: String, field: FormField): String {
    return when (field.type) {
        FormFieldType.SELECT, FormFieldType.RADIO -> {
            field.options?.find { it.value == answer }?.label ?: answer
        }

        FormFieldType.CHECKBOX, FormFieldType.MULTISELECT -> {
            val selectedValues = answer.split(",").map { it.trim() }
            selectedValues.mapNotNull { value ->
                field.options?.find { it.value == value }?.label
            }.joinToString(", ")
        }

        else -> answer
    }
}
