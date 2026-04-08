import { type PropsWithChildren, useEffect } from 'react';
import { createModuleLogger } from '../../logging/logger';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import {
  SessionUiStoreProvider,
  useSessionUiStore,
} from '../../state/sessionUiStore';

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
  const attemptSessionUnlock = useSessionUiStore(
    (state) => state.attemptUnlock,
  );

  return {
    attemptUnlock: (pin) => attemptSessionUnlock(pin, parentPin),
    isParentUnlocked: useSessionUiStore((state) => state.isParentUnlocked),
    lockParentMode: useSessionUiStore((state) => state.lockParentMode),
    unlockParentMode: useSessionUiStore((state) => state.unlockParentMode),
  } satisfies ParentSessionContextValue;
}
