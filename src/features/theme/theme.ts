import type { ColorSchemeName } from 'react-native';

import type { ResolvedTheme, ThemeMode } from '../app/types';

export type ThemeTokens = {
  accentSurface: string;
  accentText: string;
  appBackgroundChild: string;
  appBackgroundParent: string;
  border: string;
  cardSurface: string;
  controlSurface: string;
  controlSurfaceActive: string;
  controlText: string;
  controlTextMuted: string;
  controlTextOnActive: string;
  floatingLabelSurface: string;
  inputSurface: string;
  modalBackdrop: string;
  modalSurface: string;
  segmentedControlSurface: string;
  shadowColor: string;
  tabBarActiveBackground: string;
  tabBarActiveTint: string;
  tabBarBackground: string;
  tabBarInactiveTint: string;
  textMuted: string;
  textPrimary: string;
};

const LIGHT_THEME: ThemeTokens = {
  accentSurface: '#c7f9f1',
  accentText: '#0f766e',
  appBackgroundChild: '#dbeafe',
  appBackgroundParent: '#fef3c7',
  border: '#cbd5e1',
  cardSurface: '#f8fafc',
  controlSurface: '#e2e8f0',
  controlSurfaceActive: '#0f766e',
  controlText: '#334155',
  controlTextMuted: '#475569',
  controlTextOnActive: '#f8fafc',
  floatingLabelSurface: '#dbeafe',
  inputSurface: '#ffffff',
  modalBackdrop: 'rgba(15, 23, 42, 0.55)',
  modalSurface: '#f8fafc',
  segmentedControlSurface: '#e2e8f0',
  shadowColor: '#0f172a',
  tabBarActiveBackground: '#e2e8f0',
  tabBarActiveTint: '#0f172a',
  tabBarBackground: '#f8fafc',
  tabBarInactiveTint: '#64748b',
  textMuted: '#475569',
  textPrimary: '#0f172a',
};

const DARK_THEME: ThemeTokens = {
  accentSurface: '#173737',
  accentText: '#99f6e4',
  appBackgroundChild: '#08111f',
  appBackgroundParent: '#2b2111',
  border: '#334155',
  cardSurface: '#111c2b',
  controlSurface: '#1e293b',
  controlSurfaceActive: '#0f766e',
  controlText: '#e2e8f0',
  controlTextMuted: '#cbd5e1',
  controlTextOnActive: '#f8fafc',
  floatingLabelSurface: '#1d3557',
  inputSurface: '#0f172a',
  modalBackdrop: 'rgba(2, 6, 23, 0.72)',
  modalSurface: '#111c2b',
  segmentedControlSurface: '#162132',
  shadowColor: '#020617',
  tabBarActiveBackground: '#1e293b',
  tabBarActiveTint: '#f8fafc',
  tabBarBackground: '#0f172a',
  tabBarInactiveTint: '#94a3b8',
  textMuted: '#cbd5e1',
  textPrimary: '#f8fafc',
};

export function resolveThemeMode(
  themeMode: ThemeMode,
  systemColorScheme: ColorSchemeName,
): ResolvedTheme {
  if (themeMode === 'system') {
    return systemColorScheme === 'dark' ? 'dark' : 'light';
  }

  return themeMode;
}

export function getThemeTokens(resolvedTheme: ResolvedTheme) {
  return resolvedTheme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

export function getAppScreenSurface(
  tokens: ThemeTokens,
  isParentMode: boolean,
) {
  return isParentMode ? tokens.appBackgroundParent : tokens.appBackgroundChild;
}
