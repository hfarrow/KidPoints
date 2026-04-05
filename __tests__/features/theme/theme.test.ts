import { describe, expect, it } from '@jest/globals';

import {
  getAppScreenSurface,
  getThemeTokens,
  resolveThemeMode,
} from '../../../src/features/theme/theme';

describe('theme helpers', () => {
  it('resolves system theme against the device color scheme', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', 'light')).toBe('light');
    expect(resolveThemeMode('system', null)).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
  });

  it('returns distinct token sets for light and dark themes', () => {
    const light = getThemeTokens('light');
    const dark = getThemeTokens('dark');

    expect(light.cardSurface).not.toBe(dark.cardSurface);
    expect(light.textPrimary).not.toBe(dark.textPrimary);
    expect(light.tabBarBackground).not.toBe(dark.tabBarBackground);
    expect(light.tabBarActiveBackground).not.toBe(dark.tabBarActiveBackground);
  });

  it('uses a softer selected tab background in light mode', () => {
    const light = getThemeTokens('light');

    expect(light.tabBarActiveBackground).toBe('#eff6ff');
  });

  it('preserves separate child and parent surfaces in both themes', () => {
    const light = getThemeTokens('light');
    const dark = getThemeTokens('dark');

    expect(getAppScreenSurface(light, false)).toBe(light.appBackgroundChild);
    expect(getAppScreenSurface(light, true)).toBe(light.appBackgroundParent);
    expect(getAppScreenSurface(dark, false)).toBe(dark.appBackgroundChild);
    expect(getAppScreenSurface(dark, true)).toBe(dark.appBackgroundParent);
  });
});
