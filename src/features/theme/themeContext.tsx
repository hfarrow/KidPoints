import type { StatusBarStyle } from 'expo-status-bar';
import { type PropsWithChildren, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { StateStorage } from 'zustand/middleware';
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

type AppThemeValue = {
  getScreenSurface: (isParentMode: boolean) => string;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (themeMode: ThemeMode) => void;
  statusBarStyle: StatusBarStyle;
  themeMode: ThemeMode;
  tokens: ThemeTokens;
};

type AppThemeProviderProps = PropsWithChildren<{
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
}>;

export function AppThemeProvider({
  children,
  initialThemeMode = 'system',
  storage,
}: AppThemeProviderProps) {
  return (
    <LocalSettingsStoreProvider
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
