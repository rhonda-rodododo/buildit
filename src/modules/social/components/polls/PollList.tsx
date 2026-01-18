/**
 * PollList Component
 * Display a list of polls with filtering options
 */

import { FC, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, BarChart3, Clock, CheckCircle2 } from 'lucide-react';
import { PollCard } from './PollCard';
import { PollComposer } from './PollComposer';
import { useSocialStore } from '../../socialStore';
import type { Poll } from '../../types';

interface PollListProps {
  className?: string;
  showCreateButton?: boolean;
  initialTab?: 'active' | 'my-polls' | 'ended';
}

export const PollList: FC<PollListProps> = ({
  className,
  showCreateButton = true,
  initialTab = 'active',
}) => {
  const { polls, loadPolls, getActivePolls, getMyPolls } = useSocialStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await loadPolls();
      setIsLoading(false);
    };
    load();
  }, [loadPolls]);

  // Filter polls based on tab
  const activePolls = getActivePolls();
  const myPolls = getMyPolls();
  const endedPolls = polls.filter((p) => p.status === 'ended');

  const getDisplayedPolls = (): Poll[] => {
    switch (activeTab) {
      case 'active':
        return activePolls;
      case 'my-polls':
        return myPolls;
      case 'ended':
        return endedPolls;
      default:
        return activePolls;
    }
  };

  const displayedPolls = getDisplayedPolls();

  if (isLoading) {
    return (
      <div className={className}>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Polls
        </h2>
        {showCreateButton && !showComposer && (
          <Button onClick={() => setShowComposer(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Create Poll
          </Button>
        )}
      </div>

      {/* Composer */}
      {showComposer && (
        <div className="mb-6">
          <PollComposer
            onPollCreated={() => setShowComposer(false)}
            onCancel={() => setShowComposer(false)}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Active
            {activePolls.length > 0 && (
              <span className="ml-1 text-xs bg-primary/10 px-1.5 py-0.5 rounded-full">
                {activePolls.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="my-polls" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            My Polls
          </TabsTrigger>
          <TabsTrigger value="ended" className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Ended
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {displayedPolls.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-12 h-12" />}
              title="No active polls"
              description="Be the first to create a poll and gather opinions from the community."
              action={
                showCreateButton && (
                  <Button onClick={() => setShowComposer(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Poll
                  </Button>
                )
              }
            />
          ) : (
            displayedPolls.map((poll) => (
              <PollCard key={poll.id} poll={poll} showAuthor />
            ))
          )}
        </TabsContent>

        <TabsContent value="my-polls" className="space-y-4">
          {displayedPolls.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="w-12 h-12" />}
              title="No polls yet"
              description="You haven't created any polls yet. Start gathering opinions from your community!"
              action={
                showCreateButton && (
                  <Button onClick={() => setShowComposer(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Poll
                  </Button>
                )
              }
            />
          ) : (
            displayedPolls.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))
          )}
        </TabsContent>

        <TabsContent value="ended" className="space-y-4">
          {displayedPolls.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-12 h-12" />}
              title="No ended polls"
              description="Completed polls will appear here."
            />
          ) : (
            displayedPolls.map((poll) => (
              <PollCard key={poll.id} poll={poll} showAuthor />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Empty state component
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

const EmptyState: FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="text-muted-foreground/50 mb-4">{icon}</div>
    <h3 className="font-semibold text-lg mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm mb-4 max-w-sm">{description}</p>
    {action}
  </div>
);
