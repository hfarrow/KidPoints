import type { StatusBarStyle } from 'expo-status-bar';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import {
  APP_THEMES,
  getThemeDefinition,
  getThemeTokens,
  type ResolvedTheme,
  resolveTheme,
  type ThemeDefinition,
  type ThemeId,
  type ThemeMode,
  type ThemeTokens,
} from './theme';

type AppThemeValue = {
  activeTheme: ThemeDefinition;
  activeThemeId: ThemeId;
  availableThemes: readonly ThemeDefinition[];
  getScreenSurface: (isParentMode: boolean) => string;
  resolvedTheme: ResolvedTheme;
  setActiveThemeId: (themeId: ThemeId) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  statusBarStyle: StatusBarStyle;
  themeMode: ThemeMode;
  tokens: ThemeTokens;
};

export function useAppTheme() {
  const systemColorScheme = useColorScheme();
  const activeThemeId = useLocalSettingsStore((state) => state.activeThemeId);
  const setActiveThemeId = useLocalSettingsStore(
    (state) => state.setActiveThemeId,
  );
  const themeMode = useLocalSettingsStore((state) => state.themeMode);
  const setThemeMode = useLocalSettingsStore((state) => state.setThemeMode);
  const resolvedTheme = resolveTheme(
    themeMode,
    systemColorScheme === 'dark' ? 'dark' : 'light',
  );

  return useMemo<AppThemeValue>(() => {
    const activeTheme = getThemeDefinition(activeThemeId);
    const tokens = getThemeTokens(activeThemeId, resolvedTheme);

    return {
      activeTheme,
      activeThemeId,
      availableThemes: APP_THEMES,
      getScreenSurface: (isParentMode) =>
        isParentMode ? tokens.screenBackgroundParent : tokens.screenBackground,
      resolvedTheme,
      setActiveThemeId,
      setThemeMode,
      statusBarStyle: resolvedTheme === 'dark' ? 'light' : 'dark',
      themeMode,
      tokens,
    };
  }, [activeThemeId, resolvedTheme, setActiveThemeId, setThemeMode, themeMode]);
}

export function useThemedStyles<T>(factory: (theme: AppThemeValue) => T) {
  const theme = useAppTheme();

  return useMemo(() => factory(theme), [factory, theme]);
}
