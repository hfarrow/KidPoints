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
import {
  DEFAULT_THEME_ID,
  normalizeThemeId,
  type ThemeId,
  type ThemeMode,
} from '../features/theme/theme';
import {
  type AppLogLevel,
  createModuleLogger,
  createStructuredLog,
  getDefaultAppLogLevel,
  normalizeAppLogLevel,
} from '../logging/logger';
import { useStableStoreReference } from './useStableStoreReference';

type LocalSettingsState = {
  activeThemeId: ThemeId;
  hasHydrated: boolean;
  hapticsEnabled: boolean;
  logLevel: AppLogLevel;
  markHydrated: () => void;
  notificationsEnabled: boolean;
  parentPin: string | null;
  restartCountdownAfterCheckIn: boolean;
  setActiveThemeId: (themeId: ThemeId) => void;
  setHapticsEnabled: (hapticsEnabled: boolean) => void;
  setLogLevel: (logLevel: AppLogLevel) => void;
  setNotificationsEnabled: (notificationsEnabled: boolean) => void;
  setParentPin: (parentPin: string) => void;
  setRestartCountdownAfterCheckIn: (
    restartCountdownAfterCheckIn: boolean,
  ) => void;
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
  initialActiveThemeId?: ThemeId;
  allowTemporaryLogLevel?: boolean;
  initialHapticsEnabled?: boolean;
  initialLogLevel?: AppLogLevel;
  initialNotificationsEnabled?: boolean;
  initialParentPin?: string | null;
  initialRestartCountdownAfterCheckIn?: boolean;
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
}>;

export function createLocalSettingsStore({
  initialActiveThemeId = DEFAULT_THEME_ID,
  allowTemporaryLogLevel,
  initialHapticsEnabled = true,
  initialLogLevel = getDefaultAppLogLevel(),
  initialNotificationsEnabled = true,
  initialParentPin = null,
  initialRestartCountdownAfterCheckIn = true,
  initialThemeMode = 'system',
  storage = AsyncStorage,
}: {
  initialActiveThemeId?: ThemeId;
  allowTemporaryLogLevel?: boolean;
  initialHapticsEnabled?: boolean;
  initialLogLevel?: AppLogLevel;
  initialNotificationsEnabled?: boolean;
  initialParentPin?: string | null;
  initialRestartCountdownAfterCheckIn?: boolean;
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
} = {}) {
  const normalizedInitialActiveThemeId = normalizeThemeId(initialActiveThemeId);
  const normalizedInitialLogLevel = normalizeAppLogLevel(initialLogLevel, {
    allowTemporaryLogLevel,
  });

  return createStore<LocalSettingsState>()(
    persist(
      (set) => ({
        activeThemeId: normalizedInitialActiveThemeId,
        hasHydrated: false,
        hapticsEnabled: initialHapticsEnabled,
        logLevel: normalizedInitialLogLevel,
        markHydrated: () => {
          set({ hasHydrated: true });
        },
        notificationsEnabled: initialNotificationsEnabled,
        parentPin: initialParentPin,
        restartCountdownAfterCheckIn: initialRestartCountdownAfterCheckIn,
        setActiveThemeId: (activeThemeId) => {
          logLocalSettingsMutation({
            action: 'setActiveThemeId',
            activeThemeId,
          });
          set({ activeThemeId });
        },
        setHapticsEnabled: (hapticsEnabled) => {
          logLocalSettingsMutation({
            action: 'setHapticsEnabled',
            hapticsEnabled,
          });
          set({ hapticsEnabled });
        },
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
        setNotificationsEnabled: (notificationsEnabled) => {
          logLocalSettingsMutation({
            action: 'setNotificationsEnabled',
            notificationsEnabled,
          });
          set({ notificationsEnabled });
        },
        setParentPin: (parentPin) => {
          logLocalSettingsMutation({
            action: 'setParentPin',
            hasParentPin: true,
            pinLength: parentPin.length,
          });
          set({ parentPin });
        },
        setRestartCountdownAfterCheckIn: (restartCountdownAfterCheckIn) => {
          logLocalSettingsMutation({
            action: 'setRestartCountdownAfterCheckIn',
            restartCountdownAfterCheckIn,
          });
          set({ restartCountdownAfterCheckIn });
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
            activeThemeId:
              persistedSettings.activeThemeId == null
                ? normalizedInitialActiveThemeId
                : normalizeThemeId(persistedSettings.activeThemeId),
            hapticsEnabled:
              persistedSettings.hapticsEnabled ?? initialHapticsEnabled,
            logLevel: normalizeAppLogLevel(persistedSettings.logLevel, {
              allowTemporaryLogLevel,
              fallbackLogLevel: normalizedInitialLogLevel,
            }),
            notificationsEnabled:
              persistedSettings.notificationsEnabled ??
              initialNotificationsEnabled,
            restartCountdownAfterCheckIn:
              persistedSettings.restartCountdownAfterCheckIn ??
              initialRestartCountdownAfterCheckIn,
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
              activeThemeId:
                state?.activeThemeId ?? normalizedInitialActiveThemeId,
              hapticsEnabled: state?.hapticsEnabled ?? initialHapticsEnabled,
              hasParentPin: Boolean(state?.parentPin),
              logLevel: state?.logLevel ?? normalizedInitialLogLevel,
              notificationsEnabled:
                state?.notificationsEnabled ?? initialNotificationsEnabled,
              restartCountdownAfterCheckIn:
                state?.restartCountdownAfterCheckIn ??
                initialRestartCountdownAfterCheckIn,
              themeMode: state?.themeMode ?? initialThemeMode,
            });
          }

          state?.markHydrated();
        },
        partialize: ({
          activeThemeId,
          hapticsEnabled,
          logLevel,
          notificationsEnabled,
          parentPin,
          restartCountdownAfterCheckIn,
          themeMode,
        }) => ({
          activeThemeId,
          hapticsEnabled,
          logLevel,
          notificationsEnabled,
          parentPin,
          restartCountdownAfterCheckIn,
          themeMode,
        }),
        storage: createJSONStorage(() => storage),
      },
    ),
  );
}

export function LocalSettingsStoreProvider({
  initialActiveThemeId = DEFAULT_THEME_ID,
  allowTemporaryLogLevel,
  children,
  initialHapticsEnabled = true,
  initialLogLevel = getDefaultAppLogLevel(),
  initialNotificationsEnabled = true,
  initialParentPin = null,
  initialRestartCountdownAfterCheckIn = true,
  initialThemeMode = 'system',
  storage,
}: LocalSettingsStoreProviderProps) {
  const store = useStableStoreReference(
    () =>
      createLocalSettingsStore({
        initialActiveThemeId,
        allowTemporaryLogLevel,
        initialHapticsEnabled,
        initialLogLevel,
        initialNotificationsEnabled,
        initialParentPin,
        initialRestartCountdownAfterCheckIn,
        initialThemeMode,
        storage,
      }),
    {
      devRefreshToken: LOCAL_SETTINGS_STORE_BUILD_TOKEN,
    },
  );

  useEffect(() => {
    log.info('Local settings store provider initialized', {
      initialActiveThemeId,
      initialHapticsEnabled,
      initialLogLevel,
      initialNotificationsEnabled,
      initialParentPinConfigured: Boolean(initialParentPin),
      initialRestartCountdownAfterCheckIn,
      initialThemeMode,
    });
  }, [
    initialActiveThemeId,
    initialLogLevel,
    initialHapticsEnabled,
    initialNotificationsEnabled,
    initialParentPin,
    initialRestartCountdownAfterCheckIn,
    initialThemeMode,
  ]);

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
