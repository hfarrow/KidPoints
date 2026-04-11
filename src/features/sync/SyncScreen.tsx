import { useEffect, useRef } from 'react';

import { createModuleLogger } from '../../logging/logger';
import { canStartNewSyncSession, SyncScreenContent } from './SyncScreenContent';
import { SyncScreenShell } from './SyncScreenShell';
import { useNearbySyncSession } from './useNearbySyncSession';

const log = createModuleLogger('sync-screen');

function isTimeoutSyncFailure(args: {
  errorCode: string | null;
  errorMessage: string | null;
  failureReason: string | null;
  phase: ReturnType<typeof useNearbySyncSession>['state']['phase'];
}) {
  return (
    args.phase === 'error' &&
    (args.failureReason === 'timeout' ||
      args.errorCode?.includes('timeout') === true ||
      args.errorMessage?.toLowerCase().includes('timed out') === true)
  );
}

export function SyncScreen() {
  const session = useNearbySyncSession();
  const hasAutoStartedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phase = session.state.phase;
  const errorCode = session.state.errorCode;
  const errorMessage = session.state.errorMessage;
  const nfcFailureReason = session.state.nfcBootstrap.failureReason;
  const startSyncFlow = session.startSyncFlow;

  useEffect(() => {
    log.info('Sync screen initialized');

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hasAutoStartedRef.current || phase !== 'idle') {
      return;
    }

    hasAutoStartedRef.current = true;
    void startSyncFlow();
  }, [phase, startSyncFlow]);

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (
      !isTimeoutSyncFailure({
        errorCode,
        errorMessage,
        failureReason: nfcFailureReason,
        phase,
      })
    ) {
      return;
    }

    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      void startSyncFlow();
    }, 1100);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [errorCode, errorMessage, nfcFailureReason, phase, startSyncFlow]);

  return (
    <SyncScreenShell
      canStartNewSession={canStartNewSyncSession(phase)}
      phase={phase}
      onCancel={() => {
        void session.cancelSession();
      }}
    >
      <SyncScreenContent session={session} />
    </SyncScreenShell>
  );
}
