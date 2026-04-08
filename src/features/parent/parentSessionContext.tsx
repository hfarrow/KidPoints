import { type PropsWithChildren, useEffect } from 'react';
import { createModuleLogger } from '../../logging/logger';
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
  return {
    attemptUnlock: useSessionUiStore((state) => state.attemptUnlock),
    isParentUnlocked: useSessionUiStore((state) => state.isParentUnlocked),
    lockParentMode: useSessionUiStore((state) => state.lockParentMode),
    unlockParentMode: useSessionUiStore((state) => state.unlockParentMode),
  } satisfies ParentSessionContextValue;
}
