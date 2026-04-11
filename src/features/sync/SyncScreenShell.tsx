import type { PropsWithChildren } from 'react';
import { ScreenBackFooter } from '../../components/ScreenBackFooter';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { ActionPill } from '../../components/Skeleton';

export function SyncScreenShell({
  canStartNewSession,
  children,
  onCancel,
}: PropsWithChildren<{
  canStartNewSession: boolean;
  onCancel: () => void;
}>) {
  return (
    <ScreenScaffold
      footer={
        canStartNewSession ? (
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
