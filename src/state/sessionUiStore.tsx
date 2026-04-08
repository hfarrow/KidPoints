import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { useStore } from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { createModuleLogger } from '../logging/logger';

const SESSION_UI_STORAGE_KEY = 'kidpoints.session-ui.v1';
const log = createModuleLogger('session-ui-store');

type SessionUiState = {
  attemptUnlock: (pin: string, expectedPin: string | null) => boolean;
  isParentUnlocked: boolean;
  lockParentMode: () => void;
  unlockParentMode: () => void;
};

type SessionUiStore = StoreApi<SessionUiState>;

const SessionUiStoreContext = createContext<SessionUiStore | null>(null);

type SessionUiStoreProviderProps = PropsWithChildren<{
  initialParentUnlocked?: boolean;
  storage?: StateStorage;
}>;

export function createSessionUiStore({
  initialParentUnlocked,
  storage = AsyncStorage,
}: {
  initialParentUnlocked?: boolean;
  storage?: StateStorage;
} = {}) {
  return createStore<SessionUiState>()(
    persist(
      (set) => ({
        attemptUnlock: (pin, expectedPin) => {
          const didUnlock = expectedPin != null && pin === expectedPin;

          if (didUnlock) {
            log.debug('Session UI mutation committed', {
              action: 'attemptUnlock',
              isParentUnlocked: true,
            });
            set({ isParentUnlocked: true });
          } else {
            log.error('Session UI mutation rejected', {
              action: 'attemptUnlock',
              hasExpectedPin: Boolean(expectedPin),
            });
          }

          return didUnlock;
        },
        isParentUnlocked: initialParentUnlocked ?? false,
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
      }),
      {
        merge: (persistedState, currentState) => {
          const nextState = persistedState as Partial<SessionUiState> | null;

          if (typeof nextState?.isParentUnlocked !== 'boolean') {
            log.debug('Session UI rehydrate skipped invalid persisted state');
            return currentState;
          }

          log.info('Session UI rehydrated persisted state', {
            isParentUnlocked: nextState.isParentUnlocked,
          });

          return {
            ...currentState,
            isParentUnlocked: nextState.isParentUnlocked,
          };
        },
        name: SESSION_UI_STORAGE_KEY,
        partialize: ({ isParentUnlocked }) => ({ isParentUnlocked }),
        storage: createJSONStorage(() => storage),
      },
    ),
  );
}

export function SessionUiStoreProvider({
  children,
  initialParentUnlocked,
  storage,
}: SessionUiStoreProviderProps) {
  const storeRef = useRef<SessionUiStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createSessionUiStore({ initialParentUnlocked, storage });
  }

  useEffect(() => {
    log.info('Session UI store provider initialized', {
      initialParentUnlocked: initialParentUnlocked ?? false,
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
