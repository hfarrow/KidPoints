import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
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

type LocalSettingsState = {
  setThemeMode: (themeMode: ThemeMode) => void;
  themeMode: ThemeMode;
};

type LocalSettingsStore = StoreApi<LocalSettingsState>;

const LOCAL_SETTINGS_STORAGE_KEY = 'kidpoints.local-settings.v1';

const LocalSettingsStoreContext = createContext<LocalSettingsStore | null>(
  null,
);

type LocalSettingsStoreProviderProps = PropsWithChildren<{
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
}>;

export function createLocalSettingsStore({
  initialThemeMode = 'system',
  storage = AsyncStorage,
}: {
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
} = {}) {
  return createStore<LocalSettingsState>()(
    persist(
      (set) => ({
        setThemeMode: (themeMode) => {
          set({ themeMode });
        },
        themeMode: initialThemeMode,
      }),
      {
        name: LOCAL_SETTINGS_STORAGE_KEY,
        partialize: ({ themeMode }) => ({ themeMode }),
        storage: createJSONStorage(() => storage),
      },
    ),
  );
}

export function LocalSettingsStoreProvider({
  children,
  initialThemeMode = 'system',
  storage,
}: LocalSettingsStoreProviderProps) {
  const storeRef = useRef<LocalSettingsStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createLocalSettingsStore({
      initialThemeMode,
      storage,
    });
  }

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
