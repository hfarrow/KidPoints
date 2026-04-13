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
  assignMissingLogNamespaceColors,
  normalizeLogNamespaceColors,
} from '../features/logs/namespaceColors';
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
  developerModeEnabled: boolean;
  ensureLogNamespaceColors: (namespaces: string[]) => void;
  hasHydrated: boolean;
  hapticsEnabled: boolean;
  liveCountdownNotificationsEnabled: boolean;
  logNamespaceColors: Record<string, string>;
  logLevel: AppLogLevel;
  markHydrated: () => void;
  parentPin: string | null;
  resetLogNamespaceColors: () => void;
  restartCountdownAfterCheckIn: boolean;
  setActiveThemeId: (themeId: ThemeId) => void;
  setDeveloperModeEnabled: (developerModeEnabled: boolean) => void;
  setHapticsEnabled: (hapticsEnabled: boolean) => void;
  setLiveCountdownNotificationsEnabled: (
    liveCountdownNotificationsEnabled: boolean,
  ) => void;
  setLogLevel: (logLevel: AppLogLevel) => void;
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
const logLocalSettingsPersistedNamespaceColorsInvalid = createStructuredLog(
  log,
  'error',
  'Local settings rehydrate skipped invalid namespace colors',
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
  initialDeveloperModeEnabled?: boolean;
  initialHapticsEnabled?: boolean;
  initialLiveCountdownNotificationsEnabled?: boolean;
  initialLogLevel?: AppLogLevel;
  initialParentPin?: string | null;
  initialRestartCountdownAfterCheckIn?: boolean;
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
}>;

export function createLocalSettingsStore({
  initialActiveThemeId = DEFAULT_THEME_ID,
  allowTemporaryLogLevel,
  initialDeveloperModeEnabled = false,
  initialHapticsEnabled = true,
  initialLiveCountdownNotificationsEnabled = true,
  initialLogLevel = getDefaultAppLogLevel(),
  initialParentPin = null,
  initialRestartCountdownAfterCheckIn = true,
  initialThemeMode = 'system',
  storage = AsyncStorage,
}: {
  initialActiveThemeId?: ThemeId;
  allowTemporaryLogLevel?: boolean;
  initialDeveloperModeEnabled?: boolean;
  initialHapticsEnabled?: boolean;
  initialLiveCountdownNotificationsEnabled?: boolean;
  initialLogLevel?: AppLogLevel;
  initialParentPin?: string | null;
  initialRestartCountdownAfterCheckIn?: boolean;
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
} = {}) {
  const normalizedInitialActiveThemeId = normalizeThemeId(initialActiveThemeId);
  const normalizedInitialLogLevel = normalizeAppLogLevel(initialLogLevel, {
    allowTemporaryLogLevel,
  });
  const normalizedInitialLiveCountdownNotificationsEnabled =
    initialLiveCountdownNotificationsEnabled;

  return createStore<LocalSettingsState>()(
    persist(
      (set) => ({
        activeThemeId: normalizedInitialActiveThemeId,
        developerModeEnabled: initialDeveloperModeEnabled,
        ensureLogNamespaceColors: (namespaces) => {
          set((state) => {
            const nextColors = assignMissingLogNamespaceColors(
              state.logNamespaceColors,
              namespaces,
            );

            if (!nextColors.didChange) {
              return {};
            }

            return {
              logNamespaceColors: nextColors.colors,
            };
          });
        },
        hasHydrated: false,
        hapticsEnabled: initialHapticsEnabled,
        liveCountdownNotificationsEnabled:
          normalizedInitialLiveCountdownNotificationsEnabled,
        logNamespaceColors: {},
        logLevel: normalizedInitialLogLevel,
        markHydrated: () => {
          set({ hasHydrated: true });
        },
        parentPin: initialParentPin,
        resetLogNamespaceColors: () => {
          logLocalSettingsMutation({
            action: 'resetLogNamespaceColors',
          });
          set({ logNamespaceColors: {} });
        },
        restartCountdownAfterCheckIn: initialRestartCountdownAfterCheckIn,
        setActiveThemeId: (activeThemeId) => {
          logLocalSettingsMutation({
            action: 'setActiveThemeId',
            activeThemeId,
          });
          set({ activeThemeId });
        },
        setDeveloperModeEnabled: (developerModeEnabled) => {
          logLocalSettingsMutation({
            action: 'setDeveloperModeEnabled',
            developerModeEnabled,
          });
          set({ developerModeEnabled });
        },
        setHapticsEnabled: (hapticsEnabled) => {
          logLocalSettingsMutation({
            action: 'setHapticsEnabled',
            hapticsEnabled,
          });
          set({ hapticsEnabled });
        },
        setLiveCountdownNotificationsEnabled: (
          liveCountdownNotificationsEnabled,
        ) => {
          logLocalSettingsMutation({
            action: 'setLiveCountdownNotificationsEnabled',
            liveCountdownNotificationsEnabled,
          });
          set({ liveCountdownNotificationsEnabled });
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
          const persistedSettings = ((persistedState as
            | (Partial<LocalSettingsState> & {
                notificationsEnabled?: boolean;
              })
            | undefined) ?? {}) as Partial<LocalSettingsState> & {
            notificationsEnabled?: boolean;
          };
          const legacyNotificationsEnabled =
            typeof persistedSettings.notificationsEnabled === 'boolean'
              ? persistedSettings.notificationsEnabled
              : undefined;
          const liveCountdownNotificationsEnabled =
            persistedSettings.liveCountdownNotificationsEnabled ??
            legacyNotificationsEnabled ??
            normalizedInitialLiveCountdownNotificationsEnabled;
          const normalizedLogNamespaceColors = normalizeLogNamespaceColors(
            persistedSettings.logNamespaceColors,
          );

          if (normalizedLogNamespaceColors.hadInvalidEntries) {
            logLocalSettingsPersistedNamespaceColorsInvalid({
              action: 'rehydrateLogNamespaceColors',
            });
          }

          return {
            ...currentState,
            ...persistedSettings,
            activeThemeId:
              persistedSettings.activeThemeId == null
                ? normalizedInitialActiveThemeId
                : normalizeThemeId(persistedSettings.activeThemeId),
            developerModeEnabled:
              persistedSettings.developerModeEnabled ??
              initialDeveloperModeEnabled,
            hapticsEnabled:
              persistedSettings.hapticsEnabled ?? initialHapticsEnabled,
            liveCountdownNotificationsEnabled,
            logNamespaceColors: normalizedLogNamespaceColors.colors,
            logLevel: normalizeAppLogLevel(persistedSettings.logLevel, {
              allowTemporaryLogLevel,
              fallbackLogLevel: normalizedInitialLogLevel,
            }),
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
              developerModeEnabled:
                state?.developerModeEnabled ?? initialDeveloperModeEnabled,
              hapticsEnabled: state?.hapticsEnabled ?? initialHapticsEnabled,
              liveCountdownNotificationsEnabled:
                state?.liveCountdownNotificationsEnabled ??
                normalizedInitialLiveCountdownNotificationsEnabled,
              logNamespaceColorCount: Object.keys(
                state?.logNamespaceColors ?? {},
              ).length,
              hasParentPin: Boolean(state?.parentPin),
              logLevel: state?.logLevel ?? normalizedInitialLogLevel,
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
          developerModeEnabled,
          hapticsEnabled,
          liveCountdownNotificationsEnabled,
          logNamespaceColors,
          logLevel,
          parentPin,
          restartCountdownAfterCheckIn,
          themeMode,
        }) => ({
          activeThemeId,
          developerModeEnabled,
          hapticsEnabled,
          liveCountdownNotificationsEnabled,
          logNamespaceColors,
          logLevel,
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
  initialDeveloperModeEnabled = false,
  initialHapticsEnabled = true,
  initialLiveCountdownNotificationsEnabled = true,
  initialLogLevel = getDefaultAppLogLevel(),
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
        initialDeveloperModeEnabled,
        initialHapticsEnabled,
        initialLiveCountdownNotificationsEnabled,
        initialLogLevel,
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
      initialDeveloperModeEnabled,
      initialHapticsEnabled,
      initialLiveCountdownNotificationsEnabled,
      initialLogLevel,
      initialParentPinConfigured: Boolean(initialParentPin),
      initialRestartCountdownAfterCheckIn,
      initialThemeMode,
    });
  }, [
    initialActiveThemeId,
    initialDeveloperModeEnabled,
    initialLogLevel,
    initialHapticsEnabled,
    initialLiveCountdownNotificationsEnabled,
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
