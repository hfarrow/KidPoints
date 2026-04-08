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

import { createModuleLogger, createStructuredLog } from '../logging/logger';

const SESSION_UI_STORAGE_KEY = 'kidpoints.session-ui.v1';
const log = createModuleLogger('session-ui-store');
const logSessionUiMutation = createStructuredLog(
  log,
  'debug',
  'Session UI mutation committed',
);
const logRejectedSessionUiMutation = createStructuredLog(
  log,
  'error',
  'Session UI mutation rejected',
);
const logSkippedInvalidSessionUiRehydrate = createStructuredLog(
  log,
  'debug',
  'Session UI rehydrate skipped invalid persisted state',
);
const logSessionUiRehydrated = createStructuredLog(
  log,
  'info',
  'Session UI rehydrated persisted state',
);

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
            logSessionUiMutation({
              action: 'attemptUnlock',
              isParentUnlocked: true,
            });
            set({ isParentUnlocked: true });
          } else {
            logRejectedSessionUiMutation({
              action: 'attemptUnlock',
              hasExpectedPin: Boolean(expectedPin),
            });
          }

          return didUnlock;
        },
        isParentUnlocked: initialParentUnlocked ?? false,
        lockParentMode: () => {
          logSessionUiMutation({
            action: 'lockParentMode',
            isParentUnlocked: false,
          });
          set({ isParentUnlocked: false });
        },
        unlockParentMode: () => {
          logSessionUiMutation({
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
            logSkippedInvalidSessionUiRehydrate();
            return currentState;
          }

          logSessionUiRehydrated({
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
