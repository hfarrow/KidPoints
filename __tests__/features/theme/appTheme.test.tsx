import { fireEvent, render, screen } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { Pressable, Text } from 'react-native';

import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import { useAppTheme } from '../../../src/features/theme/appTheme';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

function ThemeProbe() {
  const {
    activeThemeId,
    resolvedTheme,
    setActiveThemeId,
    setThemeMode,
    themeMode,
    tokens,
  } = useAppTheme();

  return (
    <>
      <Text>{`theme:${activeThemeId}`}</Text>
      <Text>{`mode:${themeMode}`}</Text>
      <Text>{`resolved:${resolvedTheme}`}</Text>
      <Text>{`surface:${tokens.screenBackground}`}</Text>
      <Text>{`accent:${tokens.accent}`}</Text>
      <Pressable onPress={() => setActiveThemeId('gruvbox')}>
        <Text>gruvbox</Text>
      </Pressable>
      <Pressable onPress={() => setThemeMode('dark')}>
        <Text>dark</Text>
      </Pressable>
      <Pressable onPress={() => setThemeMode('light')}>
        <Text>light</Text>
      </Pressable>
    </>
  );
}

describe('useAppTheme', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('updates temporary theme mode in memory', () => {
    render(
      <AppSettingsProvider
        initialActiveThemeId="default"
        initialThemeMode="system"
        storage={createMemoryStorage()}
      >
        <ThemeProbe />
      </AppSettingsProvider>,
    );

    expect(screen.getByText('theme:default')).toBeTruthy();
    expect(screen.getByText(/resolved:/)).toBeTruthy();

    fireEvent.press(screen.getByText('gruvbox'));
    expect(screen.getByText('theme:gruvbox')).toBeTruthy();
    expect(screen.getByText('accent:#d79921')).toBeTruthy();

    fireEvent.press(screen.getByText('dark'));
    expect(screen.getByText('mode:dark')).toBeTruthy();
    expect(screen.getByText('resolved:dark')).toBeTruthy();
    expect(screen.getByText('accent:#fabd2f')).toBeTruthy();

    fireEvent.press(screen.getByText('light'));
    expect(screen.getByText('mode:light')).toBeTruthy();
    expect(screen.getByText('resolved:light')).toBeTruthy();
    expect(screen.getByText('accent:#d79921')).toBeTruthy();
  });

  it('resolves system mode for the selected theme family', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    render(
      <AppSettingsProvider
        initialActiveThemeId="gruvbox"
        initialThemeMode="system"
        storage={createMemoryStorage()}
      >
        <ThemeProbe />
      </AppSettingsProvider>,
    );

    expect(screen.getByText('theme:gruvbox')).toBeTruthy();
    expect(screen.getByText('mode:system')).toBeTruthy();
    expect(screen.getByText('resolved:dark')).toBeTruthy();
    expect(screen.getByText('surface:#282828')).toBeTruthy();
    expect(screen.getByText('accent:#fabd2f')).toBeTruthy();
  });
});
