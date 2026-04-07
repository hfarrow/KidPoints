import {
  createContext,
  type PropsWithChildren,
  useContext,
  useRef,
} from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

export const DEFAULT_PARENT_PIN = '0000';

type SessionUiState = {
  attemptUnlock: (pin: string) => boolean;
  isParentUnlocked: boolean;
  lockParentMode: () => void;
  unlockParentMode: () => void;
};

type SessionUiStore = StoreApi<SessionUiState>;

const SessionUiStoreContext = createContext<SessionUiStore | null>(null);

type SessionUiStoreProviderProps = PropsWithChildren<{
  initialParentUnlocked?: boolean;
}>;

function getDefaultParentUnlocked() {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
}

export function createSessionUiStore({
  initialParentUnlocked,
}: {
  initialParentUnlocked?: boolean;
} = {}) {
  return createStore<SessionUiState>()((set) => ({
    attemptUnlock: (pin) => {
      const didUnlock = pin === DEFAULT_PARENT_PIN;

      if (didUnlock) {
        set({ isParentUnlocked: true });
      }

      return didUnlock;
    },
    isParentUnlocked: initialParentUnlocked ?? getDefaultParentUnlocked(),
    lockParentMode: () => {
      set({ isParentUnlocked: false });
    },
    unlockParentMode: () => {
      set({ isParentUnlocked: true });
    },
  }));
}

export function SessionUiStoreProvider({
  children,
  initialParentUnlocked,
}: SessionUiStoreProviderProps) {
  const storeRef = useRef<SessionUiStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createSessionUiStore({ initialParentUnlocked });
  }

  return (
    <SessionUiStoreContext.Provider value={storeRef.current}>
      {children}
    </SessionUiStoreContext.Provider>
  );
}

export function useSessionUiStore<T>(selector: (state: SessionUiState) => T) {
  const store = useContext(SessionUiStoreContext);

  if (!store) {
    throw new Error(
      'useSessionUiStore must be used within SessionUiStoreProvider',
    );
  }

  return useStore(store, selector);
}
