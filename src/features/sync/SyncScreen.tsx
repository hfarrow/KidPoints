import { useEffect } from 'react';

import { createModuleLogger } from '../../logging/logger';
import { canStartNewSyncSession, SyncScreenContent } from './SyncScreenContent';
import { SyncScreenShell } from './SyncScreenShell';
import { useNearbySyncSession } from './useNearbySyncSession';

const log = createModuleLogger('sync-screen');

export function SyncScreen() {
  const session = useNearbySyncSession();

  useEffect(() => {
    log.info('Sync screen initialized');
  }, []);

  return (
    <SyncScreenShell
      canStartNewSession={canStartNewSyncSession(session.state.phase)}
      onCancel={() => {
        void session.cancelSession();
      }}
    >
      <SyncScreenContent session={session} />
    </SyncScreenShell>
  );
}
