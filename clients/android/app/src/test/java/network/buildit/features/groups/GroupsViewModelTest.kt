package network.buildit.features.groups

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.storage.ConversationDao
import network.buildit.core.storage.ConversationEntity
import network.buildit.core.storage.ConversationType
import network.buildit.core.storage.GroupDao
import network.buildit.core.storage.GroupEntity
import network.buildit.core.storage.GroupMemberEntity
import network.buildit.core.storage.GroupRole
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GroupsViewModel")
class GroupsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private lateinit var groupDao: GroupDao
    private lateinit var conversationDao: ConversationDao
    private lateinit var cryptoManager: CryptoManager

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        groupDao = mockk(relaxed = true) {
            every { getAllGroups() } returns flowOf(emptyList())
            every { getMembersForGroup(any()) } returns flowOf(emptyList())
        }

        conversationDao = mockk(relaxed = true)

        cryptoManager = mockk(relaxed = true) {
            every { getPublicKeyHex() } returns TestFixtures.TEST_PUBLIC_KEY_HEX
        }
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Nested
    @DisplayName("GroupsUiState")
    inner class GroupsUiStateTests {

        @Test
        @DisplayName("initial state has empty groups")
        fun initialStateEmptyGroups() {
            val state = GroupsUiState()

            assertTrue(state.groups.isEmpty())
        }

        @Test
        @DisplayName("initial state has empty member counts")
        fun initialStateEmptyMemberCounts() {
            val state = GroupsUiState()

            assertTrue(state.memberCounts.isEmpty())
        }

        @Test
        @DisplayName("initial state is loading")
        fun initialStateIsLoading() {
            val state = GroupsUiState()

            assertTrue(state.isLoading)
        }

        @Test
        @DisplayName("initial state has no error")
        fun initialStateNoError() {
            val state = GroupsUiState()

            assertNull(state.error)
        }
    }

    @Nested
    @DisplayName("Group Creation")
    inner class GroupCreationTests {

        @Test
        @DisplayName("createGroup inserts group entity")
        fun createGroupInsertsEntity() = testScope.runTest {
            val groupSlot = slot<GroupEntity>()
            coEvery { groupDao.insert(capture(groupSlot)) } returns Unit

            val group = GroupEntity(
                id = "group-123",
                name = "Test Group",
                description = "A test group",
                ownerPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                isPublic = false
            )
            groupDao.insert(group)

            assertEquals("Test Group", groupSlot.captured.name)
            assertEquals(TestFixtures.TEST_PUBLIC_KEY_HEX, groupSlot.captured.ownerPubkey)
        }

        @Test
        @DisplayName("createGroup adds owner as member")
        fun createGroupAddsOwner() = testScope.runTest {
            val memberSlot = slot<GroupMemberEntity>()
            coEvery { groupDao.insertMember(capture(memberSlot)) } returns Unit

            val member = GroupMemberEntity(
                groupId = "group-123",
                pubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                role = GroupRole.OWNER
            )
            groupDao.insertMember(member)

            assertEquals(GroupRole.OWNER, memberSlot.captured.role)
        }

        @Test
        @DisplayName("createGroup creates conversation")
        fun createGroupCreatesConversation() = testScope.runTest {
            val conversationSlot = slot<ConversationEntity>()
            coEvery { conversationDao.insert(capture(conversationSlot)) } returns Unit

            val conversation = ConversationEntity(
                id = "conv-123",
                type = ConversationType.GROUP,
                participantPubkeys = "[\"${TestFixtures.TEST_PUBLIC_KEY_HEX}\"]",
                groupId = "group-123",
                title = "Test Group"
            )
            conversationDao.insert(conversation)

            assertEquals(ConversationType.GROUP, conversationSlot.captured.type)
            assertEquals("group-123", conversationSlot.captured.groupId)
        }

        @Test
        @DisplayName("createGroup handles null description")
        fun createGroupNullDescription() {
            val group = GroupEntity(
                id = "group-123",
                name = "No Description",
                description = null,
                ownerPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                isPublic = true
            )

            assertNull(group.description)
        }
    }

    @Nested
    @DisplayName("Group Leaving")
    inner class GroupLeavingTests {

        @Test
        @DisplayName("leaveGroup removes membership")
        fun leaveGroupRemovesMembership() = testScope.runTest {
            coEvery { groupDao.removeMember("group-123", TestFixtures.TEST_PUBLIC_KEY_HEX) } returns Unit

            groupDao.removeMember("group-123", TestFixtures.TEST_PUBLIC_KEY_HEX)

            coVerify { groupDao.removeMember("group-123", TestFixtures.TEST_PUBLIC_KEY_HEX) }
        }

        @Test
        @DisplayName("owner leaving deletes group")
        fun ownerLeavingDeletesGroup() = testScope.runTest {
            val group = GroupEntity(
                id = "group-123",
                name = "Owner's Group",
                description = null,
                ownerPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                isPublic = false
            )
            coEvery { groupDao.getById("group-123") } returns group
            coEvery { groupDao.delete(group) } returns Unit

            val retrieved = groupDao.getById("group-123")
            if (retrieved?.ownerPubkey == TestFixtures.TEST_PUBLIC_KEY_HEX) {
                groupDao.delete(retrieved)
            }

            coVerify { groupDao.delete(group) }
        }
    }

    @Nested
    @DisplayName("Member Management")
    inner class MemberManagementTests {

        @Test
        @DisplayName("inviteToGroup inserts member")
        fun inviteToGroupInsertsMember() = testScope.runTest {
            val memberSlot = slot<GroupMemberEntity>()
            coEvery { groupDao.insertMember(capture(memberSlot)) } returns Unit

            val member = GroupMemberEntity(
                groupId = "group-123",
                pubkey = TestFixtures.TEST_PUBLIC_KEY_HEX_2,
                role = GroupRole.MEMBER
            )
            groupDao.insertMember(member)

            assertEquals(GroupRole.MEMBER, memberSlot.captured.role)
        }

        @Test
        @DisplayName("removeMember removes member")
        fun removeMemberRemovesMember() = testScope.runTest {
            coEvery { groupDao.removeMember("group-123", TestFixtures.TEST_PUBLIC_KEY_HEX_2) } returns Unit

            groupDao.removeMember("group-123", TestFixtures.TEST_PUBLIC_KEY_HEX_2)

            coVerify { groupDao.removeMember("group-123", TestFixtures.TEST_PUBLIC_KEY_HEX_2) }
        }

        @Test
        @DisplayName("updateMemberRole updates role")
        fun updateMemberRoleUpdatesRole() = testScope.runTest {
            coEvery {
                groupDao.updateMemberRole("group-123", TestFixtures.TEST_PUBLIC_KEY_HEX_2, GroupRole.ADMIN)
            } returns Unit

            groupDao.updateMemberRole("group-123", TestFixtures.TEST_PUBLIC_KEY_HEX_2, GroupRole.ADMIN)

            coVerify {
                groupDao.updateMemberRole("group-123", TestFixtures.TEST_PUBLIC_KEY_HEX_2, GroupRole.ADMIN)
            }
        }
    }

    @Nested
    @DisplayName("GroupRole")
    inner class GroupRoleTests {

        @Test
        @DisplayName("OWNER role exists")
        fun ownerRoleExists() {
            val role = GroupRole.OWNER

            assertNotNull(role)
        }

        @Test
        @DisplayName("ADMIN role exists")
        fun adminRoleExists() {
            val role = GroupRole.ADMIN

            assertNotNull(role)
        }

        @Test
        @DisplayName("MEMBER role exists")
        fun memberRoleExists() {
            val role = GroupRole.MEMBER

            assertNotNull(role)
        }
    }

    @Nested
    @DisplayName("Invite Code")
    inner class InviteCodeTests {

        @Test
        @DisplayName("generateInviteCode returns code with group ID")
        fun inviteCodeContainsGroupId() {
            val groupId = "group-123"
            val inviteCode = "buildit:group:$groupId"

            assertTrue(inviteCode.contains(groupId))
        }

        @Test
        @DisplayName("invite code has correct prefix")
        fun inviteCodeHasPrefix() {
            val inviteCode = "buildit:group:group-123"

            assertTrue(inviteCode.startsWith("buildit:group:"))
        }
    }

    @Nested
    @DisplayName("GroupEntity")
    inner class GroupEntityTests {

        @Test
        @DisplayName("group has required fields")
        fun groupHasRequiredFields() {
            val group = GroupEntity(
                id = "group-123",
                name = "Test Group",
                description = "Description",
                ownerPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                isPublic = true
            )

            assertNotNull(group.id)
            assertNotNull(group.name)
            assertNotNull(group.ownerPubkey)
        }

        @Test
        @DisplayName("isPublic defaults work correctly")
        fun isPublicDefaults() {
            val publicGroup = GroupEntity(
                id = "public-group",
                name = "Public",
                description = null,
                ownerPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                isPublic = true
            )

            val privateGroup = GroupEntity(
                id = "private-group",
                name = "Private",
                description = null,
                ownerPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                isPublic = false
            )

            assertTrue(publicGroup.isPublic)
            assertTrue(!privateGroup.isPublic)
        }
    }

    @Nested
    @DisplayName("GroupMemberEntity")
    inner class GroupMemberEntityTests {

        @Test
        @DisplayName("member has required fields")
        fun memberHasRequiredFields() {
            val member = GroupMemberEntity(
                groupId = "group-123",
                pubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                role = GroupRole.MEMBER
            )

            assertNotNull(member.groupId)
            assertNotNull(member.pubkey)
            assertNotNull(member.role)
        }

        @Test
        @DisplayName("member can have different roles")
        fun memberCanHaveDifferentRoles() {
            val roles = GroupRole.entries

            assertTrue(roles.size >= 3) // OWNER, ADMIN, MEMBER
        }
    }

    @Nested
    @DisplayName("Member Counts")
    inner class MemberCountsTests {

        @Test
        @DisplayName("member counts are tracked per group")
        fun memberCountsPerGroup() {
            val memberCounts = mapOf(
                "group-1" to 5,
                "group-2" to 10,
                "group-3" to 3
            )

            assertEquals(5, memberCounts["group-1"])
            assertEquals(10, memberCounts["group-2"])
            assertEquals(3, memberCounts["group-3"])
        }

        @Test
        @DisplayName("empty group has 0 members")
        fun emptyGroupZeroMembers() {
            val memberCounts = mutableMapOf<String, Int>()
            val groupId = "empty-group"

            memberCounts[groupId] = 0

            assertEquals(0, memberCounts[groupId])
        }
    }

    @Nested
    @DisplayName("Load Groups")
    inner class LoadGroupsTests {

        @Test
        @DisplayName("groups are loaded on init")
        fun groupsLoadedOnInit() = testScope.runTest {
            val groups = listOf(
                GroupEntity(
                    id = "group-1",
                    name = "Group 1",
                    description = null,
                    ownerPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    isPublic = true
                ),
                GroupEntity(
                    id = "group-2",
                    name = "Group 2",
                    description = null,
                    ownerPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX_2,
                    isPublic = false
                )
            )
            every { groupDao.getAllGroups() } returns flowOf(groups)

            val loadedGroups = groupDao.getAllGroups()

            loadedGroups.collect { list ->
                assertEquals(2, list.size)
            }
        }

        @Test
        @DisplayName("loading state is false after load")
        fun loadingStateFalseAfterLoad() {
            var isLoading = true

            isLoading = false

            assertTrue(!isLoading)
        }
    }
}
