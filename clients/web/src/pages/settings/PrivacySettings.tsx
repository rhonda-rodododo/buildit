import { FC } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { PrivacySettings as PrivacySettingsComponent } from '@/components/security/PrivacySettings';

export const PrivacySettings: FC = () => {
  return (
    <>
      <PageMeta titleKey="groups.privacy" descriptionKey="meta.privacy" path="/app/settings/privacy" />
      <PrivacySettingsComponent />
    </>
  );
};
