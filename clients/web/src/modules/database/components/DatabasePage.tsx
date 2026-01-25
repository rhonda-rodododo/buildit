/**
 * DatabasePage Component
 * Wrapper that provides context to DatabaseDashboard
 */

import { FC } from 'react';
import { useGroupContext } from '@/contexts/GroupContext';
import { useAuthStore } from '@/stores/authStore';
import { DatabaseDashboard } from './DatabaseDashboard';

export const DatabasePage: FC = () => {
  const { groupId } = useGroupContext();
  const currentIdentity = useAuthStore(state => state.currentIdentity);

  if (!groupId || !currentIdentity) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <DatabaseDashboard
      groupId={groupId}
      userPubkey={currentIdentity.publicKey}
    />
  );
};
