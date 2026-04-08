import { type PropsWithChildren, useEffect } from 'react';
import { createModuleLogger } from '../../logging/logger';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import {
  SessionUiStoreProvider,
  useSessionUiStore,
} from '../../state/sessionUiStore';
import { useSharedStore } from '../../state/sharedStore';

const log = createModuleLogger('parent-session-context');

type ParentSessionContextValue = {
  attemptUnlock: (pin: string) => boolean;
  isParentUnlocked: boolean;
  lockParentMode: () => void;
  unlockParentMode: () => void;
};

type ParentSessionProviderProps = PropsWithChildren<{
  initialParentUnlocked?: boolean;
}>;

export function ParentSessionProvider({
  children,
  initialParentUnlocked,
}: ParentSessionProviderProps) {
  useEffect(() => {
    log.info('Parent session provider initialized', {
      initialParentUnlocked: initialParentUnlocked ?? null,
    });
  }, [initialParentUnlocked]);

  return (
    <SessionUiStoreProvider initialParentUnlocked={initialParentUnlocked}>
      {children}
    </SessionUiStoreProvider>
  );
}

export function useParentSession() {
  const parentPin = useLocalSettingsStore((state) => state.parentPin);
  const isParentUnlocked = useSessionUiStore((state) => state.isParentUnlocked);
  const attemptSessionUnlock = useSessionUiStore(
    (state) => state.attemptUnlock,
  );
  const lockSessionParentMode = useSessionUiStore(
    (state) => state.lockParentMode,
  );
  const unlockSessionParentMode = useSessionUiStore(
    (state) => state.unlockParentMode,
  );
  const recordParentModeLocked = useSharedStore(
    (state) => state.recordParentModeLocked,
  );
  const recordParentUnlockAttempt = useSharedStore(
    (state) => state.recordParentUnlockAttempt,
  );

  return {
    attemptUnlock: (pin) => {
      const didUnlock = attemptSessionUnlock(pin, parentPin);

      if (parentPin) {
        recordParentUnlockAttempt(didUnlock);
      }

      return didUnlock;
    },
    isParentUnlocked,
    lockParentMode: () => {
      if (!isParentUnlocked) {
        lockSessionParentMode();
        return;
      }

      lockSessionParentMode();
      recordParentModeLocked();
    },
    unlockParentMode: unlockSessionParentMode,
  } satisfies ParentSessionContextValue;
}
