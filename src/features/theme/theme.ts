export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';
export type ThemeId = 'default' | 'gruvbox';

export type ThemeTokens = {
  accent: string;
  accentSoft: string;
  actionDecrementBorder: string;
  actionDecrementSurface: string;
  actionDecrementText: string;
  actionIncrementBorder: string;
  actionIncrementSurface: string;
  actionIncrementText: string;
  border: string;
  controlSurface: string;
  controlText: string;
  controlTrackOff: string;
  critical: string;
  criticalSurface: string;
  floatingLabelSurface: string;
  inputSurface: string;
  modalBackdrop: string;
  modalSurface: string;
  screenBackground: string;
  screenBackgroundParent: string;
  resolveAwardBorder: string;
  resolveAwardSurface: string;
  resolveAwardText: string;
  resolveDismissBorder: string;
  resolveDismissSurface: string;
  resolveDismissText: string;
  shadowColor: string;
  skeleton: string;
  success: string;
  successSurface: string;
  successText: string;
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

export type ThemeDefinition = {
  dark: ThemeTokens;
  id: ThemeId;
  label: string;
  light: ThemeTokens;
};

export const DEFAULT_THEME_ID: ThemeId = 'default';

const themesById: Record<ThemeId, ThemeDefinition> = {
  default: {
    dark: {
      accent: '#6d3df2',
      accentSoft: '#463871',
      actionDecrementBorder: '#7c3a63',
      actionDecrementSurface: '#562646',
      actionDecrementText: '#ffe5f1',
      actionIncrementBorder: '#33528d',
      actionIncrementSurface: '#1f3560',
      actionIncrementText: '#e2ecff',
      border: '#7162a6',
      controlSurface: '#5d4f93',
      controlText: '#f6f0ff',
      controlTrackOff: '#7b7397',
      critical: '#ff9ccb',
      criticalSurface: '#6a3658',
      floatingLabelSurface: '#57427d',
      inputSurface: '#463871',
      modalBackdrop: 'rgba(19, 14, 35, 0.52)',
      modalSurface: '#31295a',
      resolveAwardBorder: '#2f6a45',
      resolveAwardSurface: '#20452f',
      resolveAwardText: '#c8ffd8',
      resolveDismissBorder: '#7c3a63',
      resolveDismissSurface: '#562646',
      resolveDismissText: '#ffe5f1',
      screenBackground: '#231c41',
      screenBackgroundParent: '#2a224d',
      shadowColor: '#000000',
      skeleton: '#6c5ba3',
      success: '#4ade80',
      successSurface: '#39598a',
      successText: '#dcfce7',
      tabBarActiveBackground: '#5d4f93',
      tabBarActiveTint: '#eef6ff',
      tabBarBackground: '#1d1735',
      tabBarInactiveTint: '#c0b3e4',
      textPrimary: '#f5f0ff',
      textMuted: '#d1c7ec',
      tileBorder: '#8778ba',
      tileMutedSurface: '#31295a',
      tileSurface: '#3d336d',
    },
    id: 'default',
    label: 'KidPoints',
    light: {
      accent: '#7c3aed',
      accentSoft: '#efe3ff',
      actionDecrementBorder: '#f4b6d6',
      actionDecrementSurface: '#ffd7eb',
      actionDecrementText: '#8a1d55',
      actionIncrementBorder: '#bccffb',
      actionIncrementSurface: '#dbe8ff',
      actionIncrementText: '#23458f',
      border: '#bfaee7',
      controlSurface: '#c7c0ee',
      controlText: '#1f1d4d',
      controlTrackOff: '#94a3b8',
      critical: '#9d174d',
      criticalSurface: '#ffd9eb',
      floatingLabelSurface: '#f7dcff',
      inputSurface: '#ffffff',
      modalBackdrop: 'rgba(26, 18, 46, 0.34)',
      modalSurface: '#fdfaff',
      resolveAwardBorder: '#bce7ca',
      resolveAwardSurface: '#dff8e8',
      resolveAwardText: '#2e7d50',
      resolveDismissBorder: '#f4b6d6',
      resolveDismissSurface: '#ffd7eb',
      resolveDismissText: '#9d174d',
      screenBackground: '#fff7ff',
      screenBackgroundParent: '#fff7ff',
      shadowColor: '#120f29',
      skeleton: '#d2caef',
      success: '#15803d',
      successSurface: '#dcecff',
      successText: '#14532d',
      tabBarActiveBackground: '#cfb8fb',
      tabBarActiveTint: '#231a52',
      tabBarBackground: '#ded0fb',
      tabBarInactiveTint: '#766c9a',
      textPrimary: '#191531',
      textMuted: '#6f678f',
      tileBorder: '#c9b8ea',
      tileMutedSurface: '#d9cdf3',
      tileSurface: '#e3d5fb',
    },
  },
  gruvbox: {
    dark: {
      accent: '#fabd2f',
      accentSoft: '#665c54',
      actionDecrementBorder: '#cc241d',
      actionDecrementSurface: '#4a2d2d',
      actionDecrementText: '#fb4934',
      actionIncrementBorder: '#98971a',
      actionIncrementSurface: '#3f4a2d',
      actionIncrementText: '#b8bb26',
      border: '#928374',
      controlSurface: '#7c6f64',
      controlText: '#ebdbb2',
      controlTrackOff: '#928374',
      critical: '#fb4934',
      criticalSurface: '#5a3530',
      floatingLabelSurface: '#665c54',
      inputSurface: '#5a524c',
      modalBackdrop: 'rgba(50, 48, 47, 0.56)',
      modalSurface: '#45403d',
      resolveAwardBorder: '#98971a',
      resolveAwardSurface: '#3f4a2d',
      resolveAwardText: '#b8bb26',
      resolveDismissBorder: '#cc241d',
      resolveDismissSurface: '#4a2d2d',
      resolveDismissText: '#fb4934',
      screenBackground: '#3c3836',
      screenBackgroundParent: '#45403d',
      shadowColor: '#000000',
      skeleton: '#7c6f64',
      success: '#b8bb26',
      successSurface: '#525b2f',
      successText: '#f9f5d7',
      tabBarActiveBackground: '#665c54',
      tabBarActiveTint: '#fabd2f',
      tabBarBackground: '#32302f',
      tabBarInactiveTint: '#d5c4a1',
      textPrimary: '#ebdbb2',
      textMuted: '#d5c4a1',
      tileBorder: '#a89984',
      tileMutedSurface: '#504945',
      tileSurface: '#5a524c',
    },
    id: 'gruvbox',
    label: 'Gruvbox',
    light: {
      accent: '#d79921',
      accentSoft: '#ebdbb2',
      actionDecrementBorder: '#9d0006',
      actionDecrementSurface: '#f2d5cf',
      actionDecrementText: '#9d0006',
      actionIncrementBorder: '#79740e',
      actionIncrementSurface: '#e2dfb4',
      actionIncrementText: '#79740e',
      border: '#928374',
      controlSurface: '#ddc7a1',
      controlText: '#3c3836',
      controlTrackOff: '#bdae93',
      critical: '#9d0006',
      criticalSurface: '#f2d5cf',
      floatingLabelSurface: '#e2cca9',
      inputSurface: '#f9f5d7',
      modalBackdrop: 'rgba(60, 56, 54, 0.28)',
      modalSurface: '#fbf1c7',
      resolveAwardBorder: '#79740e',
      resolveAwardSurface: '#e2dfb4',
      resolveAwardText: '#79740e',
      resolveDismissBorder: '#9d0006',
      resolveDismissSurface: '#f2d5cf',
      resolveDismissText: '#9d0006',
      screenBackground: '#fbf1c7',
      screenBackgroundParent: '#f2e5bc',
      shadowColor: '#3c3836',
      skeleton: '#d5c4a1',
      success: '#79740e',
      successSurface: '#e2dfb4',
      successText: '#3c3836',
      tabBarActiveBackground: '#d5c4a1',
      tabBarActiveTint: '#b57614',
      tabBarBackground: '#e6d5b8',
      tabBarInactiveTint: '#7c6f64',
      textPrimary: '#3c3836',
      textMuted: '#7c6f64',
      tileBorder: '#a89984',
      tileMutedSurface: '#e2cca9',
      tileSurface: '#ebdbb2',
    },
  },
};

export const APP_THEMES: readonly ThemeDefinition[] = Object.freeze([
  themesById.default,
  themesById.gruvbox,
]);

export function getThemeDefinition(themeId: ThemeId) {
  return themesById[themeId];
}

export function normalizeThemeId(themeId: string | null | undefined): ThemeId {
  if (themeId && themeId in themesById) {
    return themeId as ThemeId;
  }

  return DEFAULT_THEME_ID;
}

export function getThemeTokens(themeId: ThemeId, theme: ResolvedTheme) {
  const definition = getThemeDefinition(themeId);

  return theme === 'dark' ? definition.dark : definition.light;
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
