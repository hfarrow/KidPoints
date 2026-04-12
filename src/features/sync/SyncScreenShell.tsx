import type { PropsWithChildren } from 'react';
import { ScreenBackFooter } from '../../components/ScreenBackFooter';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { ActionPill } from '../../components/Skeleton';
import type { SyncSessionPhase } from './syncSessionMachine';

function shouldUseBackFooter(
  phase: SyncSessionPhase,
  canStartNewSession: boolean,
) {
  return (
    canStartNewSession ||
    phase === 'idle' ||
    phase === 'bootstrapping' ||
    phase === 'hosting' ||
    phase === 'discovering' ||
    phase === 'connecting' ||
    phase === 'pairing'
  );
}

export function SyncScreenShell({
  canStartNewSession,
  children,
  onCancel,
  phase,
}: PropsWithChildren<{
  canStartNewSession: boolean;
  onCancel: () => void;
  phase: SyncSessionPhase;
}>) {
  return (
    <ScreenScaffold
      footer={
        phase === 'review' ? null : shouldUseBackFooter(
            phase,
            canStartNewSession,
          ) ? (
          <ScreenBackFooter />
        ) : (
          <ActionPill
            accessibilityLabel="Cancel Sync Session"
            label="Cancel Sync"
            onPress={onCancel}
            tone="critical"
          />
        )
      }
    >
      <ScreenHeader title="Device Sync" />
      {children}
    </ScreenScaffold>
  );
}
