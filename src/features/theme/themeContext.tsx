import type { StatusBarStyle } from 'expo-status-bar';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from 'react';

import { useAppStorage } from '../app/appStorage';
import type { ResolvedTheme, ThemeMode } from '../app/types';
import { getAppScreenSurface, getThemeTokens, type ThemeTokens } from './theme';

type AppThemeValue = {
  getScreenSurface: (isParentMode: boolean) => string;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  statusBarStyle: StatusBarStyle;
  themeMode: ThemeMode;
  tokens: ThemeTokens;
};

function createAppThemeValue(
  themeMode: ThemeMode,
  resolvedTheme: ResolvedTheme,
  setThemeMode: (mode: ThemeMode) => void,
): AppThemeValue {
  const tokens = getThemeTokens(resolvedTheme);

  return {
    getScreenSurface: (isParentMode) =>
      getAppScreenSurface(tokens, isParentMode),
    resolvedTheme,
    setThemeMode,
    statusBarStyle: resolvedTheme === 'dark' ? 'light' : 'dark',
    themeMode,
    tokens,
  };
}

const DEFAULT_THEME = createAppThemeValue('system', 'light', () => {});

const AppThemeContext = createContext<AppThemeValue>(DEFAULT_THEME);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const { resolvedTheme, setThemeMode, themeMode } = useAppStorage();

  const value = useMemo(
    () => createAppThemeValue(themeMode, resolvedTheme, setThemeMode),
    [resolvedTheme, setThemeMode, themeMode],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}

export function useThemedStyles<T>(factory: (theme: AppThemeValue) => T) {
  const theme = useAppTheme();

  return useMemo(() => factory(theme), [theme, factory]);
}
