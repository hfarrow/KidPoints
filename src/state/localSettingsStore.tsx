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
import type { ThemeMode } from '../features/theme/theme';
import {
  type AppLogLevel,
  createModuleLogger,
  getDefaultAppLogLevel,
} from '../logging/logger';

type LocalSettingsState = {
  logLevel: AppLogLevel;
  setLogLevel: (logLevel: AppLogLevel) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  themeMode: ThemeMode;
};

type LocalSettingsStore = StoreApi<LocalSettingsState>;

const LOCAL_SETTINGS_STORAGE_KEY = 'kidpoints.local-settings.v1';
const log = createModuleLogger('local-settings-store');

const LocalSettingsStoreContext = createContext<LocalSettingsStore | null>(
  null,
);

type LocalSettingsStoreProviderProps = PropsWithChildren<{
  initialLogLevel?: AppLogLevel;
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
}>;

export function createLocalSettingsStore({
  initialLogLevel = getDefaultAppLogLevel(),
  initialThemeMode = 'system',
  storage = AsyncStorage,
}: {
  initialLogLevel?: AppLogLevel;
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
} = {}) {
  return createStore<LocalSettingsState>()(
    persist(
      (set) => ({
        logLevel: initialLogLevel,
        setLogLevel: (logLevel) => {
          log.debug('Local settings mutation committed', {
            action: 'setLogLevel',
            logLevel,
          });
          set({ logLevel });
        },
        setThemeMode: (themeMode) => {
          log.debug('Local settings mutation committed', {
            action: 'setThemeMode',
            themeMode,
          });
          set({ themeMode });
        },
        themeMode: initialThemeMode,
      }),
      {
        name: LOCAL_SETTINGS_STORAGE_KEY,
        partialize: ({ logLevel, themeMode }) => ({ logLevel, themeMode }),
        storage: createJSONStorage(() => storage),
      },
    ),
  );
}

export function LocalSettingsStoreProvider({
  children,
  initialLogLevel = getDefaultAppLogLevel(),
  initialThemeMode = 'system',
  storage,
}: LocalSettingsStoreProviderProps) {
  const storeRef = useRef<LocalSettingsStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createLocalSettingsStore({
      initialLogLevel,
      initialThemeMode,
      storage,
    });
  }

  useEffect(() => {
    log.info('Local settings store provider initialized', {
      initialLogLevel,
      initialThemeMode,
    });
  }, [initialLogLevel, initialThemeMode]);

  return (
    <LocalSettingsStoreContext.Provider value={storeRef.current}>
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
