import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { createModuleLogger } from '../logging/logger';

export const DEFAULT_PARENT_PIN = '0000';
const log = createModuleLogger('session-ui-store');

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
        log.debug('Session UI mutation committed', {
          action: 'attemptUnlock',
          isParentUnlocked: true,
        });
        set({ isParentUnlocked: true });
      } else {
        log.error('Session UI mutation rejected', {
          action: 'attemptUnlock',
        });
      }

      return didUnlock;
    },
    isParentUnlocked: initialParentUnlocked ?? getDefaultParentUnlocked(),
    lockParentMode: () => {
      log.debug('Session UI mutation committed', {
        action: 'lockParentMode',
        isParentUnlocked: false,
      });
      set({ isParentUnlocked: false });
    },
    unlockParentMode: () => {
      log.debug('Session UI mutation committed', {
        action: 'unlockParentMode',
        isParentUnlocked: true,
      });
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

  useEffect(() => {
    log.info('Session UI store provider initialized', {
      initialParentUnlocked:
        initialParentUnlocked ?? getDefaultParentUnlocked(),
    });
  }, [initialParentUnlocked]);

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
