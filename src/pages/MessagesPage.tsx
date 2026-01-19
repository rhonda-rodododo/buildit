import { FC } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { MessagingView } from '@/components/messaging/MessagingView';

export const MessagesPage: FC = () => {
  return (
    <>
      <PageMeta titleKey="messages.title" descriptionKey="meta.messages" path="/app/messages" />
      <MessagingView />
    </>
  );
};
