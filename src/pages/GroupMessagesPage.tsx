import { FC } from 'react';
import { useGroupContext } from '@/contexts/GroupContext';
import { MessagingView } from '@/components/messaging/MessagingView';
import { Card } from '@/components/ui/card';

/**
 * Group Messages Page
 * Group chat and threaded conversations
 */
export const GroupMessagesPage: FC = () => {
  const { group, groupId, isLoading } = useGroupContext();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!group) {
    return <div>Group not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="text-muted-foreground">
          Group conversations and threads
        </p>
      </div>

      <Card className="p-0 overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        <MessagingView groupId={groupId} />
      </Card>
    </div>
  );
};
