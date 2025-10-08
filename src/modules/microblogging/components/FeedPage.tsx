/**
 * FeedPage Component
 * Main page view for the activity feed
 */

import { FC } from 'react';
import { ActivityFeed } from './ActivityFeed';

export const FeedPage: FC = () => {
  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Activity Feed</h1>
        <p className="text-muted-foreground">
          Stay up to date with posts, events, and updates from your network
        </p>
      </div>

      <ActivityFeed showComposer={true} />
    </div>
  );
};
