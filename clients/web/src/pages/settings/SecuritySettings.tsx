import { FC } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { SecurityPage } from './SecurityPage';

export const SecuritySettings: FC = () => {
  return (
    <>
      <PageMeta titleKey="common.security" descriptionKey="meta.security" path="/app/settings/security" />
      <SecurityPage />
    </>
  );
};
