package network.buildit.modules.contacts.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

// Import generated protocol enums as source of truth
import network.buildit.generated.schemas.contacts.NoteCategory
import network.buildit.generated.schemas.contacts.PredefinedTag

// ============================================================================
// Extension properties for generated enums (UI display, icons, colors)
// ============================================================================

val NoteCategory.displayName: String
    get() = when (this) {
        NoteCategory.General -> "General"
        NoteCategory.Meeting -> "Meeting"
        NoteCategory.FollowUp -> "Follow Up"
        NoteCategory.Concern -> "Concern"
        NoteCategory.Positive -> "Positive"
        NoteCategory.Task -> "Task"
    }

val NoteCategory.icon: String
    get() = when (this) {
        NoteCategory.General -> "note_text"
        NoteCategory.Meeting -> "people"
        NoteCategory.FollowUp -> "arrow_forward"
        NoteCategory.Concern -> "warning"
        NoteCategory.Positive -> "star"
        NoteCategory.Task -> "checklist"
    }

val PredefinedTag.displayName: String
    get() = when (this) {
        PredefinedTag.Volunteer -> "Volunteer"
        PredefinedTag.Member -> "Member"
        PredefinedTag.Leader -> "Leader"
        PredefinedTag.MediaContact -> "Media Contact"
        PredefinedTag.Ally -> "Ally"
        PredefinedTag.Potential -> "Potential"
        PredefinedTag.Inactive -> "Inactive"
        PredefinedTag.UnionRep -> "Union Rep"
        PredefinedTag.Steward -> "Steward"
        PredefinedTag.Donor -> "Donor"
    }

val PredefinedTag.color: String
    get() = when (this) {
        PredefinedTag.Volunteer -> "#10B981"
        PredefinedTag.Member -> "#3B82F6"
        PredefinedTag.Leader -> "#8B5CF6"
        PredefinedTag.MediaContact -> "#F59E0B"
        PredefinedTag.Ally -> "#06B6D4"
        PredefinedTag.Potential -> "#6B7280"
        PredefinedTag.Inactive -> "#9CA3AF"
        PredefinedTag.UnionRep -> "#EF4444"
        PredefinedTag.Steward -> "#EC4899"
        PredefinedTag.Donor -> "#14B8A6"
    }

fun PredefinedTag.toEntity(groupId: String? = null): ContactTagEntity {
    return ContactTagEntity(
        id = java.util.UUID.randomUUID().toString(),
        name = displayName,
        color = color,
        groupId = groupId
    )
}

// ============================================================================
// Room Entities
// ============================================================================

/**
 * Room entity for contact notes.
 */
@Entity(
    tableName = "contact_notes",
    indices = [
        Index("contactPubkey"),
        Index("category"),
        Index("createdAt")
    ]
)
data class ContactNoteEntity(
    @PrimaryKey
    val id: String,
    val contactPubkey: String,
    val content: String,
    val category: NoteCategory = NoteCategory.General,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long? = null
)

/**
 * Room entity for contact tags.
 */
@Entity(
    tableName = "contact_tags",
    indices = [
        Index("groupId"),
        Index("name")
    ]
)
data class ContactTagEntity(
    @PrimaryKey
    val id: String,
    val name: String,
    val color: String = "#3B82F6",
    val groupId: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * Room entity for tag assignments to contacts.
 */
@Entity(
    tableName = "contact_tag_assignments",
    primaryKeys = ["contactPubkey", "tagId"],
    indices = [
        Index("contactPubkey"),
        Index("tagId")
    ]
)
data class ContactTagAssignmentEntity(
    val contactPubkey: String,
    val tagId: String,
    val assignedAt: Long = System.currentTimeMillis()
)

/**
 * Contact with notes and tags for display.
 */
data class ContactWithNotesAndTags(
    val contactPubkey: String,
    val displayName: String?,
    val notes: List<ContactNoteEntity>,
    val tags: List<ContactTagEntity>
) {
    val hasNotes: Boolean get() = notes.isNotEmpty()
    val hasTags: Boolean get() = tags.isNotEmpty()

    val recentNote: ContactNoteEntity?
        get() = notes.maxByOrNull { it.updatedAt ?: it.createdAt }
}

/**
 * Filter options for contacts by tags.
 */
data class ContactTagFilter(
    val includedTags: Set<String> = emptySet(),
    val excludedTags: Set<String> = emptySet(),
    val requireAll: Boolean = false
) {
    val isEmpty: Boolean get() = includedTags.isEmpty() && excludedTags.isEmpty()

    fun matches(contactTagIds: Set<String>): Boolean {
        // Check excluded tags first
        if (excludedTags.isNotEmpty() && excludedTags.intersect(contactTagIds).isNotEmpty()) {
            return false
        }

        // Check included tags
        if (includedTags.isEmpty()) {
            return true
        }

        return if (requireAll) {
            includedTags.all { it in contactTagIds }
        } else {
            includedTags.any { it in contactTagIds }
        }
    }
}
