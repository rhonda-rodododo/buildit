import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupContext } from '@/contexts/GroupContext';
import { PageMeta } from '@/components/PageMeta';
import { MessagingView } from '@/components/messaging/MessagingView';
import { Card } from '@/components/ui/card';

/**
 * Group Messages Page
 * Group chat and threaded conversations
 */
export const GroupMessagesPage: FC = () => {
  const { t } = useTranslation();
  const { group, groupId, isLoading } = useGroupContext();

  if (isLoading) {
    return <div>{t('groupMessagesPage.loading')}</div>;
  }

  if (!group) {
    return <div>{t('groupMessagesPage.notFound')}</div>;
  }

  return (
    <div className="h-full flex flex-col p-4">
      <PageMeta
        title={`${group.name} - ${t('groupMessagesPage.title')}`}
        descriptionKey="meta.messages"
      />
      <div className="mb-4">
        <h1 className="text-3xl font-bold">{t('groupMessagesPage.title')}</h1>
        <p className="text-muted-foreground">
          {t('groupMessagesPage.subtitle')}
        </p>
      </div>

      <Card className="flex-1 p-0 overflow-hidden min-h-0">
        <MessagingView groupId={groupId} />
      </Card>
    </div>
  );
};
