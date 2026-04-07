import type { StatusBarStyle } from 'expo-status-bar';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

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

const AppThemeContext = createContext<AppThemeValue | null>(null);

type AppThemeProviderProps = PropsWithChildren<{
  initialThemeMode?: ThemeMode;
}>;

export function AppThemeProvider({
  children,
  initialThemeMode = 'system',
}: AppThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const resolvedTheme = resolveTheme(
    themeMode,
    systemColorScheme === 'dark' ? 'dark' : 'light',
  );

  const value = useMemo<AppThemeValue>(() => {
    const tokens = getThemeTokens(resolvedTheme);

    return {
      getScreenSurface: () => tokens.screenBackground,
      resolvedTheme,
      setThemeMode,
      statusBarStyle: resolvedTheme === 'dark' ? 'light' : 'dark',
      themeMode,
      tokens,
    };
  }, [resolvedTheme, themeMode]);

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);

  if (!value) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }

  return value;
}

export function useThemedStyles<T>(factory: (theme: AppThemeValue) => T) {
  const theme = useAppTheme();

  return useMemo(() => factory(theme), [factory, theme]);
}
