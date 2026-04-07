export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export type ThemeTokens = {
  accent: string;
  accentSoft: string;
  border: string;
  controlSurface: string;
  controlText: string;
  critical: string;
  criticalSurface: string;
  floatingLabelSurface: string;
  inputSurface: string;
  modalBackdrop: string;
  modalSurface: string;
  screenBackground: string;
  screenBackgroundParent: string;
  shadowColor: string;
  skeleton: string;
  successSurface: string;
  tabBarActiveBackground: string;
  tabBarActiveTint: string;
  tabBarBackground: string;
  tabBarInactiveTint: string;
  textPrimary: string;
  textMuted: string;
  tileBorder: string;
  tileMutedSurface: string;
  tileSurface: string;
};

const lightTokens: ThemeTokens = {
  accent: '#0f766e',
  accentSoft: '#d7f3ee',
  border: '#d5dde5',
  controlSurface: '#e5edf4',
  controlText: '#153243',
  critical: '#b42318',
  criticalSurface: '#fee4e2',
  floatingLabelSurface: '#fff7d6',
  inputSurface: '#ffffff',
  modalBackdrop: 'rgba(18, 24, 38, 0.38)',
  modalSurface: '#fbfdff',
  screenBackground: '#eef3f8',
  screenBackgroundParent: '#f6f1df',
  shadowColor: '#0f172a',
  skeleton: '#d7e0e8',
  successSurface: '#d8f4ea',
  tabBarActiveBackground: '#dce9f6',
  tabBarActiveTint: '#153243',
  tabBarBackground: '#f8fbfe',
  tabBarInactiveTint: '#617184',
  textPrimary: '#13212f',
  textMuted: '#5d6b7b',
  tileBorder: '#dce5ed',
  tileMutedSurface: '#f2f6fa',
  tileSurface: '#fbfdff',
};

const darkTokens: ThemeTokens = {
  accent: '#5dd4c4',
  accentSoft: '#163738',
  border: '#2d3748',
  controlSurface: '#1d2835',
  controlText: '#eff6ff',
  critical: '#ff8a80',
  criticalSurface: '#4a1f1d',
  floatingLabelSurface: '#514417',
  inputSurface: '#15202b',
  modalBackdrop: 'rgba(3, 9, 18, 0.6)',
  modalSurface: '#101a24',
  screenBackground: '#0b1320',
  screenBackgroundParent: '#1b1a11',
  shadowColor: '#000000',
  skeleton: '#253243',
  successSurface: '#15352b',
  tabBarActiveBackground: '#213144',
  tabBarActiveTint: '#eef6ff',
  tabBarBackground: '#0f1823',
  tabBarInactiveTint: '#8fa1b5',
  textPrimary: '#eef4fb',
  textMuted: '#9fb0c3',
  tileBorder: '#243243',
  tileMutedSurface: '#111d29',
  tileSurface: '#15202b',
};

export function getThemeTokens(theme: ResolvedTheme) {
  return theme === 'dark' ? darkTokens : lightTokens;
}

export function resolveTheme(
  themeMode: ThemeMode,
  systemTheme: ResolvedTheme | null | undefined,
): ResolvedTheme {
  if (themeMode === 'system') {
    return systemTheme ?? 'light';
  }

  return themeMode;
}
