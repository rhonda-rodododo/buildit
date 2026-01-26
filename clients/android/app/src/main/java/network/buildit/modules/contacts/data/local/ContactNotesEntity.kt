package network.buildit.modules.contacts.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Category of a contact note.
 */
enum class NoteCategory(val displayName: String, val icon: String) {
    GENERAL("General", "note_text"),
    MEETING("Meeting", "people"),
    FOLLOW_UP("Follow Up", "arrow_forward"),
    CONCERN("Concern", "warning"),
    POSITIVE("Positive", "star"),
    TASK("Task", "checklist")
}

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
    val category: NoteCategory = NoteCategory.GENERAL,
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
 * Predefined tags for organizers.
 */
enum class PredefinedTag(val displayName: String, val color: String) {
    VOLUNTEER("Volunteer", "#10B981"),
    MEMBER("Member", "#3B82F6"),
    LEADER("Leader", "#8B5CF6"),
    MEDIA_CONTACT("Media Contact", "#F59E0B"),
    ALLY("Ally", "#06B6D4"),
    POTENTIAL("Potential", "#6B7280"),
    INACTIVE("Inactive", "#9CA3AF"),
    UNION_REP("Union Rep", "#EF4444"),
    STEWARD("Steward", "#EC4899"),
    DONOR("Donor", "#14B8A6");

    fun toEntity(groupId: String? = null): ContactTagEntity {
        return ContactTagEntity(
            id = java.util.UUID.randomUUID().toString(),
            name = displayName,
            color = color,
            groupId = groupId
        )
    }
}

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
