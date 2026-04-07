import type { PropsWithChildren } from 'react';
import {
  SessionUiStoreProvider,
  useSessionUiStore,
} from '../../state/sessionUiStore';

type ShellSessionContextValue = {
  attemptUnlock: (pin: string) => boolean;
  isParentUnlocked: boolean;
  lockParentMode: () => void;
  unlockParentMode: () => void;
};

type ShellSessionProviderProps = PropsWithChildren<{
  initialParentUnlocked?: boolean;
}>;

export function ShellSessionProvider({
  children,
  initialParentUnlocked,
}: ShellSessionProviderProps) {
  return (
    <SessionUiStoreProvider initialParentUnlocked={initialParentUnlocked}>
      {children}
    </SessionUiStoreProvider>
  );
}

export function useShellSession() {
  return {
    attemptUnlock: useSessionUiStore((state) => state.attemptUnlock),
    isParentUnlocked: useSessionUiStore((state) => state.isParentUnlocked),
    lockParentMode: useSessionUiStore((state) => state.lockParentMode),
    unlockParentMode: useSessionUiStore((state) => state.unlockParentMode),
  } satisfies ShellSessionContextValue;
}
