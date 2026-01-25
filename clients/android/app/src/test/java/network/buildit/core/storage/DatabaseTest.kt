package network.buildit.core.storage

import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.EnumSource
import org.junit.jupiter.params.provider.ValueSource

@DisplayName("Database Entities and Converters")
class DatabaseTest {

    @Nested
    @DisplayName("ContactEntity")
    inner class ContactEntityTests {

        @Test
        @DisplayName("can create with all fields")
        fun createWithAllFields() {
            val contact = TestFixtures.createContactEntity()

            assertNotNull(contact.pubkey)
            assertNotNull(contact.displayName)
            assertFalse(contact.isBlocked)
            assertFalse(contact.isTrusted)
        }

        @Test
        @DisplayName("pubkey is primary key")
        fun pubkeyIsPrimaryKey() {
            val contact = TestFixtures.createContactEntity(pubkey = "unique-key")

            assertEquals("unique-key", contact.pubkey)
        }

        @Test
        @DisplayName("nullable fields can be null")
        fun nullableFieldsCanBeNull() {
            val contact = ContactEntity(
                pubkey = "key",
                displayName = null,
                avatarUrl = null,
                nip05 = null,
                about = null,
                lastSeenAt = null
            )

            assertNull(contact.displayName)
            assertNull(contact.avatarUrl)
            assertNull(contact.nip05)
            assertNull(contact.about)
            assertNull(contact.lastSeenAt)
        }

        @Test
        @DisplayName("default timestamps are set")
        fun defaultTimestampsSet() {
            val before = System.currentTimeMillis()
            val contact = ContactEntity(pubkey = "key", displayName = null, avatarUrl = null, nip05 = null, about = null)
            val after = System.currentTimeMillis()

            assertTrue(contact.createdAt >= before)
            assertTrue(contact.createdAt <= after)
            assertTrue(contact.updatedAt >= before)
            assertTrue(contact.updatedAt <= after)
        }

        @Test
        @DisplayName("copy works correctly")
        fun copyWorks() {
            val original = TestFixtures.createContactEntity(displayName = "Original")

            val copy = original.copy(displayName = "Updated")

            assertEquals("Updated", copy.displayName)
            assertEquals(original.pubkey, copy.pubkey)
        }
    }

    @Nested
    @DisplayName("ConversationEntity")
    inner class ConversationEntityTests {

        @Test
        @DisplayName("can create with required fields")
        fun createWithRequiredFields() {
            val conversation = TestFixtures.createConversationEntity()

            assertNotNull(conversation.id)
            assertNotNull(conversation.type)
            assertNotNull(conversation.participantPubkeys)
        }

        @Test
        @DisplayName("id is primary key")
        fun idIsPrimaryKey() {
            val conversation = TestFixtures.createConversationEntity(id = "conv-123")

            assertEquals("conv-123", conversation.id)
        }

        @ParameterizedTest
        @EnumSource(ConversationType::class)
        @DisplayName("all conversation types are valid")
        fun allTypesValid(type: ConversationType) {
            val conversation = TestFixtures.createConversationEntity(type = type)

            assertEquals(type, conversation.type)
        }

        @Test
        @DisplayName("default unread count is 0")
        fun defaultUnreadCountIsZero() {
            val conversation = ConversationEntity(
                id = "id",
                type = ConversationType.DIRECT,
                participantPubkeys = "[]"
            )

            assertEquals(0, conversation.unreadCount)
        }

        @Test
        @DisplayName("isPinned defaults to false")
        fun isPinnedDefaultsFalse() {
            val conversation = ConversationEntity(
                id = "id",
                type = ConversationType.DIRECT,
                participantPubkeys = "[]"
            )

            assertFalse(conversation.isPinned)
        }

        @Test
        @DisplayName("isMuted defaults to false")
        fun isMutedDefaultsFalse() {
            val conversation = ConversationEntity(
                id = "id",
                type = ConversationType.DIRECT,
                participantPubkeys = "[]"
            )

            assertFalse(conversation.isMuted)
        }

        @Test
        @DisplayName("group conversation has groupId")
        fun groupConversationHasGroupId() {
            val conversation = TestFixtures.createConversationEntity(
                type = ConversationType.GROUP,
                groupId = "group-123"
            )

            assertEquals(ConversationType.GROUP, conversation.type)
            assertEquals("group-123", conversation.groupId)
        }
    }

    @Nested
    @DisplayName("MessageEntity")
    inner class MessageEntityTests {

        @Test
        @DisplayName("can create with required fields")
        fun createWithRequiredFields() {
            val message = TestFixtures.createMessageEntity()

            assertNotNull(message.id)
            assertNotNull(message.conversationId)
            assertNotNull(message.senderPubkey)
            assertNotNull(message.content)
            assertTrue(message.timestamp > 0)
        }

        @Test
        @DisplayName("id is primary key")
        fun idIsPrimaryKey() {
            val message = TestFixtures.createMessageEntity(id = "msg-123")

            assertEquals("msg-123", message.id)
        }

        @ParameterizedTest
        @EnumSource(MessageContentType::class)
        @DisplayName("all content types are valid")
        fun allContentTypesValid(type: MessageContentType) {
            val message = TestFixtures.createMessageEntity(contentType = type)

            assertEquals(type, message.contentType)
        }

        @ParameterizedTest
        @EnumSource(MessageStatus::class)
        @DisplayName("all message statuses are valid")
        fun allStatusesValid(status: MessageStatus) {
            val message = TestFixtures.createMessageEntity(status = status)

            assertEquals(status, message.status)
        }

        @Test
        @DisplayName("replyToId can be null")
        fun replyToIdCanBeNull() {
            val message = TestFixtures.createMessageEntity(replyToId = null)

            assertNull(message.replyToId)
        }

        @Test
        @DisplayName("replyToId can reference another message")
        fun replyToIdCanReference() {
            val message = TestFixtures.createMessageEntity(replyToId = "parent-msg-123")

            assertEquals("parent-msg-123", message.replyToId)
        }

        @Test
        @DisplayName("readAt is null by default")
        fun readAtNullByDefault() {
            val message = TestFixtures.createMessageEntity()

            assertNull(message.readAt)
        }
    }

    @Nested
    @DisplayName("GroupEntity")
    inner class GroupEntityTests {

        @Test
        @DisplayName("can create with required fields")
        fun createWithRequiredFields() {
            val group = GroupEntity(
                id = "group-123",
                name = "Test Group",
                ownerPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX
            )

            assertNotNull(group.id)
            assertNotNull(group.name)
            assertNotNull(group.ownerPubkey)
        }

        @Test
        @DisplayName("id is primary key")
        fun idIsPrimaryKey() {
            val group = GroupEntity(
                id = "unique-group",
                name = "Group",
                ownerPubkey = "owner"
            )

            assertEquals("unique-group", group.id)
        }

        @Test
        @DisplayName("isPublic defaults to false")
        fun isPublicDefaultsFalse() {
            val group = GroupEntity(
                id = "id",
                name = "Private Group",
                ownerPubkey = "owner"
            )

            assertFalse(group.isPublic)
        }

        @Test
        @DisplayName("description can be null")
        fun descriptionCanBeNull() {
            val group = GroupEntity(
                id = "id",
                name = "Group",
                ownerPubkey = "owner",
                description = null
            )

            assertNull(group.description)
        }
    }

    @Nested
    @DisplayName("GroupMemberEntity")
    inner class GroupMemberEntityTests {

        @Test
        @DisplayName("has composite primary key")
        fun hasCompositePrimaryKey() {
            val member = GroupMemberEntity(
                groupId = "group-1",
                pubkey = "member-pubkey"
            )

            assertNotNull(member.groupId)
            assertNotNull(member.pubkey)
        }

        @ParameterizedTest
        @EnumSource(GroupRole::class)
        @DisplayName("all group roles are valid")
        fun allRolesValid(role: GroupRole) {
            val member = GroupMemberEntity(
                groupId = "group",
                pubkey = "pubkey",
                role = role
            )

            assertEquals(role, member.role)
        }

        @Test
        @DisplayName("default role is MEMBER")
        fun defaultRoleIsMember() {
            val member = GroupMemberEntity(
                groupId = "group",
                pubkey = "pubkey"
            )

            assertEquals(GroupRole.MEMBER, member.role)
        }

        @Test
        @DisplayName("joinedAt has default timestamp")
        fun joinedAtHasDefault() {
            val before = System.currentTimeMillis()
            val member = GroupMemberEntity(
                groupId = "group",
                pubkey = "pubkey"
            )
            val after = System.currentTimeMillis()

            assertTrue(member.joinedAt >= before)
            assertTrue(member.joinedAt <= after)
        }
    }

    @Nested
    @DisplayName("LinkedDeviceEntity")
    inner class LinkedDeviceEntityTests {

        @Test
        @DisplayName("can create with required fields")
        fun createWithRequiredFields() {
            val device = LinkedDeviceEntity(
                deviceId = "device-123",
                name = "My Phone",
                deviceType = DeviceType.ANDROID,
                publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX
            )

            assertNotNull(device.deviceId)
            assertNotNull(device.name)
            assertNotNull(device.deviceType)
            assertNotNull(device.publicKey)
        }

        @ParameterizedTest
        @EnumSource(DeviceType::class)
        @DisplayName("all device types are valid")
        fun allTypesValid(type: DeviceType) {
            val device = LinkedDeviceEntity(
                deviceId = "id",
                name = "Device",
                deviceType = type,
                publicKey = "key"
            )

            assertEquals(type, device.deviceType)
        }

        @Test
        @DisplayName("lastSyncAt can be null")
        fun lastSyncAtCanBeNull() {
            val device = LinkedDeviceEntity(
                deviceId = "id",
                name = "Device",
                deviceType = DeviceType.ANDROID,
                publicKey = "key",
                lastSyncAt = null
            )

            assertNull(device.lastSyncAt)
        }

        @Test
        @DisplayName("linkedAt has default timestamp")
        fun linkedAtHasDefault() {
            val before = System.currentTimeMillis()
            val device = LinkedDeviceEntity(
                deviceId = "id",
                name = "Device",
                deviceType = DeviceType.ANDROID,
                publicKey = "key"
            )
            val after = System.currentTimeMillis()

            assertTrue(device.linkedAt >= before)
            assertTrue(device.linkedAt <= after)
        }
    }

    @Nested
    @DisplayName("Converters")
    inner class ConvertersTests {

        private val converters = Converters()

        @ParameterizedTest
        @EnumSource(ConversationType::class)
        @DisplayName("ConversationType round-trips correctly")
        fun conversationTypeRoundTrips(type: ConversationType) {
            val string = converters.fromConversationType(type)
            val restored = converters.toConversationType(string)

            assertEquals(type, restored)
        }

        @ParameterizedTest
        @EnumSource(MessageContentType::class)
        @DisplayName("MessageContentType round-trips correctly")
        fun messageContentTypeRoundTrips(type: MessageContentType) {
            val string = converters.fromMessageContentType(type)
            val restored = converters.toMessageContentType(string)

            assertEquals(type, restored)
        }

        @ParameterizedTest
        @EnumSource(MessageStatus::class)
        @DisplayName("MessageStatus round-trips correctly")
        fun messageStatusRoundTrips(status: MessageStatus) {
            val string = converters.fromMessageStatus(status)
            val restored = converters.toMessageStatus(string)

            assertEquals(status, restored)
        }

        @ParameterizedTest
        @EnumSource(GroupRole::class)
        @DisplayName("GroupRole round-trips correctly")
        fun groupRoleRoundTrips(role: GroupRole) {
            val string = converters.fromGroupRole(role)
            val restored = converters.toGroupRole(string)

            assertEquals(role, restored)
        }

        @ParameterizedTest
        @EnumSource(DeviceType::class)
        @DisplayName("DeviceType round-trips correctly")
        fun deviceTypeRoundTrips(type: DeviceType) {
            val string = converters.fromDeviceType(type)
            val restored = converters.toDeviceType(string)

            assertEquals(type, restored)
        }
    }

    @Nested
    @DisplayName("Enums")
    inner class EnumTests {

        @Test
        @DisplayName("ConversationType has DIRECT and GROUP")
        fun conversationTypeValues() {
            val values = ConversationType.values()

            assertEquals(2, values.size)
            assertTrue(values.contains(ConversationType.DIRECT))
            assertTrue(values.contains(ConversationType.GROUP))
        }

        @Test
        @DisplayName("MessageContentType has all content types")
        fun messageContentTypeValues() {
            val values = MessageContentType.values()

            assertEquals(5, values.size)
            assertTrue(values.contains(MessageContentType.TEXT))
            assertTrue(values.contains(MessageContentType.IMAGE))
            assertTrue(values.contains(MessageContentType.FILE))
            assertTrue(values.contains(MessageContentType.VOICE))
            assertTrue(values.contains(MessageContentType.LOCATION))
        }

        @Test
        @DisplayName("MessageStatus has all statuses")
        fun messageStatusValues() {
            val values = MessageStatus.values()

            assertEquals(5, values.size)
            assertTrue(values.contains(MessageStatus.PENDING))
            assertTrue(values.contains(MessageStatus.SENT))
            assertTrue(values.contains(MessageStatus.DELIVERED))
            assertTrue(values.contains(MessageStatus.READ))
            assertTrue(values.contains(MessageStatus.FAILED))
        }

        @Test
        @DisplayName("GroupRole has OWNER, ADMIN, MEMBER")
        fun groupRoleValues() {
            val values = GroupRole.values()

            assertEquals(3, values.size)
            assertTrue(values.contains(GroupRole.OWNER))
            assertTrue(values.contains(GroupRole.ADMIN))
            assertTrue(values.contains(GroupRole.MEMBER))
        }

        @Test
        @DisplayName("DeviceType has all device types")
        fun deviceTypeValues() {
            val values = DeviceType.values()

            assertEquals(4, values.size)
            assertTrue(values.contains(DeviceType.ANDROID))
            assertTrue(values.contains(DeviceType.IOS))
            assertTrue(values.contains(DeviceType.DESKTOP))
            assertTrue(values.contains(DeviceType.WEB))
        }
    }
}
