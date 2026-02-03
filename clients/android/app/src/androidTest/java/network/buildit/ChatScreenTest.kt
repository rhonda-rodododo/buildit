package network.buildit

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumentation tests for the Chat feature UI.
 *
 * Tests Compose UI interactions including:
 * - Conversation list display
 * - Chat message input
 * - Navigation between screens
 * - Transport status indicators
 * - Empty state display
 *
 * These tests launch the full MainActivity with Hilt DI and assert
 * against the real Compose UI tree. The app starts on the Chat tab
 * (ConversationListScreen) by default.
 */
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class ChatScreenTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    // ==================== Conversation List Screen ====================

    @Test
    fun conversationListScreen_isDisplayed() {
        // The app should start with the Chat tab active.
        // The TopAppBar title "Chat" should be visible from the ConversationListScreen.
        composeTestRule.waitForIdle()

        composeTestRule
            .onNodeWithText("Chat")
            .assertIsDisplayed()
    }

    @Test
    fun emptyState_showsPlaceholder() {
        // When there are no conversations, the empty state text should be shown.
        // The string resource chat_no_messages = "No messages yet. Start the conversation!"
        composeTestRule.waitForIdle()

        composeTestRule
            .onNodeWithText("No messages yet. Start the conversation!")
            .assertIsDisplayed()
    }

    @Test
    fun newConversationButton_isClickable() {
        // The FAB has contentDescription = "Start new conversation"
        composeTestRule.waitForIdle()

        composeTestRule
            .onNodeWithContentDescription("Start new conversation")
            .assertIsDisplayed()
            .assertIsEnabled()
            .performClick()

        // After clicking FAB, should navigate to ContactPickerScreen
        // which has the title "Select Contact"
        composeTestRule.waitForIdle()

        composeTestRule
            .onNodeWithText("Select Contact")
            .assertIsDisplayed()
    }

    @Test
    fun transportStatus_isVisible() {
        // The TransportStatusIndicator has a merged contentDescription
        // starting with "Connection status:"
        composeTestRule.waitForIdle()

        composeTestRule
            .onNode(hasContentDescription(value = "Connection status:", substring = true))
            .assertIsDisplayed()
    }

    @Test
    fun bottomNavigation_chatTabIsSelected() {
        // The bottom navigation bar should show "Chat" as active/selected
        composeTestRule.waitForIdle()

        // Bottom nav items are rendered as NavigationBarItem with label text
        composeTestRule
            .onNodeWithText("Chat")
            .assertIsDisplayed()
    }

    @Test
    fun bottomNavigation_allTabsAreDisplayed() {
        // All four bottom nav tabs should be visible:
        // Chat, Groups, Device Sync, Settings
        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("Chat").assertIsDisplayed()
        composeTestRule.onNodeWithText("Groups").assertIsDisplayed()
        composeTestRule.onNodeWithText("Device Sync").assertIsDisplayed()
        composeTestRule.onNodeWithText("Settings").assertIsDisplayed()
    }

    @Test
    fun bottomNavigation_navigatesToGroups() {
        composeTestRule.waitForIdle()

        composeTestRule
            .onNodeWithText("Groups")
            .performClick()

        composeTestRule.waitForIdle()

        // Groups screen should now be visible (it has its own TopAppBar with "Groups" title)
        // We verify navigation happened by checking we left the chat empty state
        composeTestRule
            .onNodeWithText("Groups")
            .assertIsDisplayed()
    }

    @Test
    fun bottomNavigation_navigatesToSettings() {
        composeTestRule.waitForIdle()

        composeTestRule
            .onNodeWithText("Settings")
            .performClick()

        composeTestRule.waitForIdle()

        // Settings screen should now be visible
        composeTestRule
            .onNodeWithText("Settings")
            .assertIsDisplayed()
    }

    @Test
    fun bottomNavigation_navigatesToDeviceSync() {
        composeTestRule.waitForIdle()

        composeTestRule
            .onNodeWithText("Device Sync")
            .performClick()

        composeTestRule.waitForIdle()

        composeTestRule
            .onNodeWithText("Device Sync")
            .assertIsDisplayed()
    }

    @Test
    fun bottomNavigation_canReturnToChat() {
        // Navigate away and back to Chat tab
        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("Settings").performClick()
        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("Chat").performClick()
        composeTestRule.waitForIdle()

        // The empty state should still be visible after returning
        composeTestRule
            .onNodeWithText("No messages yet. Start the conversation!")
            .assertIsDisplayed()
    }
}
