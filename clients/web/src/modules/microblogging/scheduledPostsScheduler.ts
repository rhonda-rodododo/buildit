/**
 * Scheduled Posts Scheduler
 * Background job that automatically publishes scheduled posts when they are due
 */

import { usePostsStore } from './postsStore';

const CHECK_INTERVAL_MS = 60_000; // Check every minute

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Process due scheduled posts
 * Called periodically to publish posts that are past their scheduled time
 */
async function processDueScheduledPosts(): Promise<void> {
  if (isRunning) {
    // Prevent concurrent runs
    return;
  }

  isRunning = true;

  try {
    const store = usePostsStore.getState();
    const duePosts = store.getDueScheduledPosts();

    if (duePosts.length === 0) {
      return;
    }

    for (const scheduledPost of duePosts) {
      try {
        await store.publishScheduledPost(scheduledPost.id);
      } catch (error) {
        console.error(`[ScheduledPostsScheduler] Failed to publish scheduled post ${scheduledPost.id}:`, error);
        // Mark as failed in the database
        try {
          const { scheduledPosts } = usePostsStore.getState();
          const post = scheduledPosts.find((sp) => sp.id === scheduledPost.id);
          if (post && post.status === 'pending') {
            // Update status to failed after multiple attempts could be added here
            // For now, we just log the error and it will retry on next interval
          }
        } catch {
          // Ignore secondary errors
        }
      }
    }
  } catch (error) {
    console.error('[ScheduledPostsScheduler] Error processing due posts:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduled posts scheduler
 * Should be called when the app initializes or user logs in
 */
export function startScheduledPostsScheduler(): void {
  if (schedulerInterval) {
    // Already running
    return;
  }

  // Run immediately on start
  processDueScheduledPosts();

  // Then run periodically
  schedulerInterval = setInterval(processDueScheduledPosts, CHECK_INTERVAL_MS);
}

/**
 * Stop the scheduled posts scheduler
 * Should be called when user logs out or app is closing
 */
export function stopScheduledPostsScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

/**
 * Check if the scheduler is currently running
 */
export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}

/**
 * Manually trigger a check for due posts
 * Useful for testing or when user wants immediate processing
 */
export async function triggerScheduledPostsCheck(): Promise<void> {
  await processDueScheduledPosts();
}
