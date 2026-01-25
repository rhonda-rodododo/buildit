/**
 * Posts Store Tests
 * Tests for reactions, reposts, bookmarks, and social interactions
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '@/test/test-utils';
import { usePostsStore } from './postsStore';

describe('PostsStore - Advanced Social Features', () => {
  beforeAll(async () => {
    // Initialize database with all module schemas
    await setupTestDatabase();
  });

  afterAll(async () => {
    // Clean up database
    await teardownTestDatabase();
  });

  beforeEach(() => {
    // Clear the store before each test
    usePostsStore.getState().clearCache();
  });

  describe('Reactions', () => {
    it('should add a reaction to a post', async () => {
      const { createPost, addReaction, getPost } = usePostsStore.getState();

      // Create a post
      const post = await createPost({
        content: 'Test post for reactions',
        visibility: { privacy: 'public' },
      });

      // Add a reaction
      await addReaction(post.id, '❤️');

      // Verify reaction was added
      const updatedPost = getPost(post.id);
      expect(updatedPost?.reactionCount).toBe(1);
    });

    it('should remove a reaction from a post', async () => {
      const { createPost, addReaction, removeReaction, getPost } = usePostsStore.getState();

      const post = await createPost({
        content: 'Test post',
        visibility: { privacy: 'public' },
      });

      await addReaction(post.id, '✊');
      await removeReaction(post.id);

      const updatedPost = getPost(post.id);
      expect(updatedPost?.reactionCount).toBe(0);
    });

    it('should track user reactions', async () => {
      const { createPost, addReaction, getMyReaction } = usePostsStore.getState();

      const post = await createPost({
        content: 'Test post',
        visibility: { privacy: 'public' },
      });

      await addReaction(post.id, '🔥');

      const myReaction = getMyReaction(post.id);
      expect(myReaction).toBe('🔥');
    });

    it('should change reaction type', async () => {
      const { createPost, addReaction, getMyReaction, getPost } = usePostsStore.getState();

      const post = await createPost({
        content: 'Test post',
        visibility: { privacy: 'public' },
      });

      await addReaction(post.id, '👍');
      await addReaction(post.id, '😂');

      const myReaction = getMyReaction(post.id);
      const updatedPost = getPost(post.id);

      expect(myReaction).toBe('😂');
      expect(updatedPost?.reactionCount).toBe(1); // Should still be 1, not 2
    });

    it('should get all reactions for a post', async () => {
      const { createPost, addReaction, getPostReactions } = usePostsStore.getState();

      const post = await createPost({
        content: 'Test post',
        visibility: { privacy: 'public' },
      });

      await addReaction(post.id, '❤️');

      const reactions = getPostReactions(post.id);
      expect(reactions.length).toBe(1);
      expect(reactions[0].type).toBe('❤️');
      expect(reactions[0].postId).toBe(post.id);
    });
  });

  describe('Reposts', () => {
    it('should repost a post', async () => {
      const { createPost, repost, getPost, hasReposted } = usePostsStore.getState();

      const post = await createPost({
        content: 'Test post for reposting',
        visibility: { privacy: 'public' },
      });

      await repost(post.id);

      const updatedPost = getPost(post.id);
      expect(updatedPost?.repostCount).toBe(1);
      expect(hasReposted(post.id)).toBe(true);
    });

    it('should unrepost a post', async () => {
      const { createPost, repost, unrepost, getPost, hasReposted } = usePostsStore.getState();

      const post = await createPost({
        content: 'Test post',
        visibility: { privacy: 'public' },
      });

      await repost(post.id);
      await unrepost(post.id);

      const updatedPost = getPost(post.id);
      expect(updatedPost?.repostCount).toBe(0);
      expect(hasReposted(post.id)).toBe(false);
    });

    it('should create a quote post', async () => {
      const { createPost, quotePost } = usePostsStore.getState();

      const post = await createPost({
        content: 'Original post',
        visibility: { privacy: 'public' },
      });

      await quotePost(post.id, 'This is my take on it!');

      // Verify the quote was created (check reposts)
      const { reposts } = usePostsStore.getState();
      const quoteRepost = reposts.find((r) => r.postId === post.id && r.isQuote);

      expect(quoteRepost).toBeDefined();
      expect(quoteRepost?.quoteContent).toBe('This is my take on it!');
    });
  });

  describe('Bookmarks', () => {
    it('should bookmark a post', async () => {
      const { createPost, bookmarkPost, getPost, hasBookmarked } = usePostsStore.getState();

      const post = await createPost({
        content: 'Test post for bookmarking',
        visibility: { privacy: 'public' },
      });

      await bookmarkPost(post.id);

      const updatedPost = getPost(post.id);
      expect(updatedPost?.bookmarkCount).toBe(1);
      expect(hasBookmarked(post.id)).toBe(true);
    });

    it('should unbookmark a post', async () => {
      const { createPost, bookmarkPost, unbookmarkPost, getPost, hasBookmarked } =
        usePostsStore.getState();

      const post = await createPost({
        content: 'Test post',
        visibility: { privacy: 'public' },
      });

      await bookmarkPost(post.id);
      await unbookmarkPost(post.id);

      const updatedPost = getPost(post.id);
      expect(updatedPost?.bookmarkCount).toBe(0);
      expect(hasBookmarked(post.id)).toBe(false);
    });

    it('should get all bookmarked posts', async () => {
      const { createPost, bookmarkPost, getBookmarkedPosts } = usePostsStore.getState();

      const post1 = await createPost({
        content: 'First post',
        visibility: { privacy: 'public' },
      });

      const post2 = await createPost({
        content: 'Second post',
        visibility: { privacy: 'public' },
      });

      await bookmarkPost(post1.id);
      await bookmarkPost(post2.id);

      const bookmarkedPosts = getBookmarkedPosts();
      expect(bookmarkedPosts.length).toBe(2);
      expect(bookmarkedPosts.some((p) => p.id === post1.id)).toBe(true);
      expect(bookmarkedPosts.some((p) => p.id === post2.id)).toBe(true);
    });
  });

  describe('Comments', () => {
    it('should add a comment to a post', async () => {
      const { createPost, addComment, getPost, getPostComments } = usePostsStore.getState();

      const post = await createPost({
        content: 'Test post',
        visibility: { privacy: 'public' },
      });

      await addComment(post.id, 'Great post!');

      const updatedPost = getPost(post.id);
      const comments = getPostComments(post.id);

      expect(updatedPost?.commentCount).toBe(1);
      expect(comments.length).toBe(1);
      expect(comments[0].content).toBe('Great post!');
    });

    it('should add nested comments', async () => {
      const { createPost, addComment, getPostComments } = usePostsStore.getState();

      const post = await createPost({
        content: 'Test post',
        visibility: { privacy: 'public' },
      });

      const comment1 = await addComment(post.id, 'Parent comment');
      await addComment(post.id, 'Child comment', comment1.id);

      const comments = getPostComments(post.id);
      expect(comments.length).toBe(2);

      const childComment = comments.find((c) => c.parentCommentId === comment1.id);
      expect(childComment).toBeDefined();
      expect(childComment?.depth).toBe(1);
    });

    it('should delete a comment', async () => {
      const { createPost, addComment, deleteComment, getPost } = usePostsStore.getState();

      const post = await createPost({
        content: 'Test post',
        visibility: { privacy: 'public' },
      });

      const comment = await addComment(post.id, 'Comment to delete');
      await deleteComment(comment.id);

      const updatedPost = getPost(post.id);
      expect(updatedPost?.commentCount).toBe(0);
    });
  });

  describe('Post Feed', () => {
    it('should filter posts by search query', async () => {
      const { createPost, getPosts } = usePostsStore.getState();

      await createPost({
        content: 'Post about cats',
        visibility: { privacy: 'public' },
      });

      await createPost({
        content: 'Post about dogs',
        visibility: { privacy: 'public' },
      });

      const catPosts = getPosts({ type: 'all', searchQuery: 'cats' });
      expect(catPosts.length).toBe(1);
      expect(catPosts[0].content).toContain('cats');
    });

    it('should filter posts by hashtags', async () => {
      const { createPost, getPosts } = usePostsStore.getState();

      await createPost({
        content: 'Post with hashtag',
        visibility: { privacy: 'public' },
        hashtags: ['testing', 'important'],
      });

      await createPost({
        content: 'Another post',
        visibility: { privacy: 'public' },
        hashtags: ['random'],
      });

      const testingPosts = getPosts({ type: 'all', hashtags: ['testing'] });
      expect(testingPosts.length).toBe(1);
      expect(testingPosts[0].hashtags).toContain('testing');
    });

    it('should get bookmarked posts only', async () => {
      const { createPost, bookmarkPost, getPosts } = usePostsStore.getState();

      const post1 = await createPost({
        content: 'Bookmarked post',
        visibility: { privacy: 'public' },
      });

      await createPost({
        content: 'Not bookmarked',
        visibility: { privacy: 'public' },
      });

      await bookmarkPost(post1.id);

      const bookmarkedPosts = getPosts({ type: 'bookmarks' });
      expect(bookmarkedPosts.length).toBe(1);
      expect(bookmarkedPosts[0].id).toBe(post1.id);
    });
  });

  describe('Post Management', () => {
    it('should update a post', async () => {
      const { createPost, updatePost, getPost } = usePostsStore.getState();

      const post = await createPost({
        content: 'Original content',
        visibility: { privacy: 'public' },
      });

      await updatePost({
        postId: post.id,
        content: 'Updated content',
      });

      const updatedPost = getPost(post.id);
      expect(updatedPost?.content).toBe('Updated content');
      expect(updatedPost?.updatedAt).toBeDefined();
    });

    it('should delete a post and related data', async () => {
      const { createPost, addReaction, addComment, bookmarkPost, deletePost, getPost } =
        usePostsStore.getState();

      const post = await createPost({
        content: 'Post to delete',
        visibility: { privacy: 'public' },
      });

      await addReaction(post.id, '❤️');
      await addComment(post.id, 'Comment');
      await bookmarkPost(post.id);

      await deletePost(post.id);

      const deletedPost = getPost(post.id);
      expect(deletedPost).toBeUndefined();

      // Verify related data is also deleted
      const { reactions, comments, bookmarks } = usePostsStore.getState();
      expect(reactions.some((r) => r.postId === post.id)).toBe(false);
      expect(comments.some((c) => c.postId === post.id)).toBe(false);
      expect(bookmarks.some((b) => b.postId === post.id)).toBe(false);
    });
  });
});
