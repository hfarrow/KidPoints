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
  accent: '#7c3aed',
  accentSoft: '#efe3ff',
  border: '#ccbef0',
  controlSurface: '#d1cff9',
  controlText: '#1f1d4d',
  critical: '#9d174d',
  criticalSurface: '#ffd9eb',
  floatingLabelSurface: '#f7dcff',
  inputSurface: '#ffffff',
  modalBackdrop: 'rgba(26, 18, 46, 0.34)',
  modalSurface: '#fdfaff',
  screenBackground: '#fff7ff',
  screenBackgroundParent: '#fff7ff',
  shadowColor: '#120f29',
  skeleton: '#d2caef',
  successSurface: '#dcecff',
  tabBarActiveBackground: '#d6c2ff',
  tabBarActiveTint: '#231a52',
  tabBarBackground: '#e6d7ff',
  tabBarInactiveTint: '#766c9a',
  textPrimary: '#191531',
  textMuted: '#6f678f',
  tileBorder: '#d5c7f2',
  tileMutedSurface: '#e5daf8',
  tileSurface: '#ebdfff',
};

const darkTokens: ThemeTokens = {
  accent: '#6d3df2',
  accentSoft: '#30204f',
  border: '#473b75',
  controlSurface: '#403572',
  controlText: '#f6f0ff',
  critical: '#ff9ccb',
  criticalSurface: '#4d2440',
  floatingLabelSurface: '#3b2451',
  inputSurface: '#1d1635',
  modalBackdrop: 'rgba(5, 3, 14, 0.62)',
  modalSurface: '#140f27',
  screenBackground: '#120d1d',
  screenBackgroundParent: '#120d1d',
  shadowColor: '#000000',
  skeleton: '#4a3d7f',
  successSurface: '#2a4470',
  tabBarActiveBackground: '#4b397f',
  tabBarActiveTint: '#eef6ff',
  tabBarBackground: '#0d0918',
  tabBarInactiveTint: '#a294ca',
  textPrimary: '#f5f0ff',
  textMuted: '#b2a6d2',
  tileBorder: '#514387',
  tileMutedSurface: '#161027',
  tileSurface: '#231c41',
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
