/**
 * HomePage Component
 * Main page with activity feed and post composer
 */

import { FC, useEffect } from 'react';
import { PostComposer } from '@/modules/microblogging/components/PostComposer';
import { ActivityFeed } from '@/components/feed/ActivityFeed';
import { usePostsStore } from '@/modules/microblogging/postsStore';
import { microbloggingSeeds } from '@/modules/microblogging/schema';

export const HomePage: FC = () => {
  const { posts, createPost } = usePostsStore();

  useEffect(() => {
    // Load seed posts if no posts exist (demo data)
    const loadSeedPosts = async () => {
      if (posts.length === 0) {
        for (const seedPost of microbloggingSeeds.posts) {
          await createPost({
            content: seedPost.content,
            contentType: seedPost.contentType,
            visibility: seedPost.visibility,
            hashtags: seedPost.hashtags,
          });
        }
      }
    };

    loadSeedPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Post Composer (Sticky) */}
      <div className="sticky top-16 z-40">
        <PostComposer />
      </div>

      {/* Activity Feed */}
      <ActivityFeed />
    </div>
  );
};
