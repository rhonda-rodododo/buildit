import { FC } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { MessagingView } from '@/components/messaging/MessagingView';

export const MessagesPage: FC = () => {
  return (
    <div className="h-full flex flex-col p-4">
      <PageMeta titleKey="messages.title" descriptionKey="meta.messages" path="/app/messages" />
      <MessagingView />
    </div>
  );
};
