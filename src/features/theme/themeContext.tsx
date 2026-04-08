import type { StatusBarStyle } from 'expo-status-bar';
import { type PropsWithChildren, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { StateStorage } from 'zustand/middleware';
import type { AppLogLevel } from '../../logging/logger';
import { createModuleLogger } from '../../logging/logger';
import {
  LocalSettingsStoreProvider,
  useLocalSettingsStore,
} from '../../state/localSettingsStore';
import {
  getThemeTokens,
  type ResolvedTheme,
  resolveTheme,
  type ThemeMode,
  type ThemeTokens,
} from './theme';

const log = createModuleLogger('theme-context');

type AppThemeValue = {
  getScreenSurface: (isParentMode: boolean) => string;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (themeMode: ThemeMode) => void;
  statusBarStyle: StatusBarStyle;
  themeMode: ThemeMode;
  tokens: ThemeTokens;
};

type AppThemeProviderProps = PropsWithChildren<{
  initialLogLevel?: AppLogLevel;
  initialParentPin?: string | null;
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
}>;

export function AppThemeProvider({
  children,
  initialLogLevel,
  initialParentPin,
  initialThemeMode = 'system',
  storage,
}: AppThemeProviderProps) {
  useEffect(() => {
    log.info('App theme provider initialized', {
      initialThemeMode,
    });
  }, [initialThemeMode]);

  return (
    <LocalSettingsStoreProvider
      initialLogLevel={initialLogLevel}
      initialParentPin={initialParentPin}
      initialThemeMode={initialThemeMode}
      storage={storage}
    >
      {children}
    </LocalSettingsStoreProvider>
  );
}

export function useAppTheme() {
  const systemColorScheme = useColorScheme();
  const themeMode = useLocalSettingsStore((state) => state.themeMode);
  const setThemeMode = useLocalSettingsStore((state) => state.setThemeMode);
  const resolvedTheme = resolveTheme(
    themeMode,
    systemColorScheme === 'dark' ? 'dark' : 'light',
  );

  return useMemo<AppThemeValue>(() => {
    const tokens = getThemeTokens(resolvedTheme);

    return {
      getScreenSurface: (isParentMode) =>
        isParentMode ? tokens.screenBackgroundParent : tokens.screenBackground,
      resolvedTheme,
      setThemeMode,
      statusBarStyle: resolvedTheme === 'dark' ? 'light' : 'dark',
      themeMode,
      tokens,
    };
  }, [resolvedTheme, setThemeMode, themeMode]);
}

export function useThemedStyles<T>(factory: (theme: AppThemeValue) => T) {
  const theme = useAppTheme();

  return useMemo(() => factory(theme), [factory, theme]);
}
