import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
} from 'react';
import { useStore } from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ThemeMode } from '../features/theme/theme';
import {
  type AppLogLevel,
  createModuleLogger,
  createStructuredLog,
  getDefaultAppLogLevel,
  normalizeAppLogLevel,
} from '../logging/logger';
import { useStableStoreReference } from './useStableStoreReference';

type LocalSettingsState = {
  hasHydrated: boolean;
  logLevel: AppLogLevel;
  markHydrated: () => void;
  parentPin: string | null;
  setLogLevel: (logLevel: AppLogLevel) => void;
  setParentPin: (parentPin: string) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  themeMode: ThemeMode;
};

type LocalSettingsStore = StoreApi<LocalSettingsState>;

const LOCAL_SETTINGS_STORAGE_KEY = 'kidpoints.local-settings.v1';
const LOCAL_SETTINGS_STORE_BUILD_TOKEN = Symbol('local-settings-store-build');
const log = createModuleLogger('local-settings-store');
const logLocalSettingsMutation = createStructuredLog(
  log,
  'debug',
  'Local settings mutation committed',
);
const logLocalSettingsRehydrateFailed = createStructuredLog(
  log,
  'error',
  'Local settings rehydrate failed',
);
const logLocalSettingsRehydrated = createStructuredLog(
  log,
  'info',
  'Local settings rehydrated persisted state',
);

const LocalSettingsStoreContext = createContext<LocalSettingsStore | null>(
  null,
);

type LocalSettingsStoreProviderProps = PropsWithChildren<{
  allowTemporaryLogLevel?: boolean;
  initialLogLevel?: AppLogLevel;
  initialParentPin?: string | null;
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
}>;

export function createLocalSettingsStore({
  allowTemporaryLogLevel,
  initialLogLevel = getDefaultAppLogLevel(),
  initialParentPin = null,
  initialThemeMode = 'system',
  storage = AsyncStorage,
}: {
  allowTemporaryLogLevel?: boolean;
  initialLogLevel?: AppLogLevel;
  initialParentPin?: string | null;
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
} = {}) {
  const normalizedInitialLogLevel = normalizeAppLogLevel(initialLogLevel, {
    allowTemporaryLogLevel,
  });

  return createStore<LocalSettingsState>()(
    persist(
      (set) => ({
        hasHydrated: false,
        logLevel: normalizedInitialLogLevel,
        markHydrated: () => {
          set({ hasHydrated: true });
        },
        parentPin: initialParentPin,
        setLogLevel: (logLevel) => {
          const normalizedLogLevel = normalizeAppLogLevel(logLevel, {
            allowTemporaryLogLevel,
            fallbackLogLevel: normalizedInitialLogLevel,
          });

          logLocalSettingsMutation({
            action: 'setLogLevel',
            logLevel: normalizedLogLevel,
            requestedLogLevel: logLevel,
          });
          set({ logLevel: normalizedLogLevel });
        },
        setParentPin: (parentPin) => {
          logLocalSettingsMutation({
            action: 'setParentPin',
            hasParentPin: true,
            pinLength: parentPin.length,
          });
          set({ parentPin });
        },
        setThemeMode: (themeMode) => {
          logLocalSettingsMutation({
            action: 'setThemeMode',
            themeMode,
          });
          set({ themeMode });
        },
        themeMode: initialThemeMode,
      }),
      {
        merge: (persistedState, currentState) => {
          const persistedSettings =
            (persistedState as Partial<LocalSettingsState> | undefined) ?? {};

          return {
            ...currentState,
            ...persistedSettings,
            logLevel: normalizeAppLogLevel(persistedSettings.logLevel, {
              allowTemporaryLogLevel,
              fallbackLogLevel: normalizedInitialLogLevel,
            }),
          };
        },
        name: LOCAL_SETTINGS_STORAGE_KEY,
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            logLocalSettingsRehydrateFailed({
              error: error instanceof Error ? error.message : String(error),
            });
          } else {
            logLocalSettingsRehydrated({
              hasParentPin: Boolean(state?.parentPin),
              logLevel: state?.logLevel ?? normalizedInitialLogLevel,
              themeMode: state?.themeMode ?? initialThemeMode,
            });
          }

          state?.markHydrated();
        },
        partialize: ({ logLevel, parentPin, themeMode }) => ({
          logLevel,
          parentPin,
          themeMode,
        }),
        storage: createJSONStorage(() => storage),
      },
    ),
  );
}

export function LocalSettingsStoreProvider({
  allowTemporaryLogLevel,
  children,
  initialLogLevel = getDefaultAppLogLevel(),
  initialParentPin = null,
  initialThemeMode = 'system',
  storage,
}: LocalSettingsStoreProviderProps) {
  const store = useStableStoreReference(
    () =>
      createLocalSettingsStore({
        allowTemporaryLogLevel,
        initialLogLevel,
        initialParentPin,
        initialThemeMode,
        storage,
      }),
    {
      devRefreshToken: LOCAL_SETTINGS_STORE_BUILD_TOKEN,
    },
  );

  useEffect(() => {
    log.info('Local settings store provider initialized', {
      initialLogLevel,
      initialParentPinConfigured: Boolean(initialParentPin),
      initialThemeMode,
    });
  }, [initialLogLevel, initialParentPin, initialThemeMode]);

  return (
    <LocalSettingsStoreContext.Provider value={store}>
      {children}
    </LocalSettingsStoreContext.Provider>
  );
}

export function useLocalSettingsStore<T>(
  selector: (state: LocalSettingsState) => T,
) {
  const store = useContext(LocalSettingsStoreContext);

  if (!store) {
    throw new Error(
      'useLocalSettingsStore must be used within LocalSettingsStoreProvider',
    );
  }

  return useStore(store, selector);
}
