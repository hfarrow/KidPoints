import type { PropsWithChildren } from 'react';
import {
  SessionUiStoreProvider,
  useSessionUiStore,
} from '../../state/sessionUiStore';

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
