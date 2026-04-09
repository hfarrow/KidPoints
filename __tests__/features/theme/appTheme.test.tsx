import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import { useAppTheme } from '../../../src/features/theme/appTheme';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

function ThemeProbe() {
  const { resolvedTheme, setThemeMode, themeMode, tokens } = useAppTheme();

  return (
    <>
      <Text>{`mode:${themeMode}`}</Text>
      <Text>{`resolved:${resolvedTheme}`}</Text>
      <Text>{`surface:${tokens.screenBackground}`}</Text>
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
  it('updates temporary theme mode in memory', () => {
    render(
      <AppSettingsProvider
        initialThemeMode="system"
        storage={createMemoryStorage()}
      >
        <ThemeProbe />
      </AppSettingsProvider>,
    );

    expect(screen.getByText(/resolved:/)).toBeTruthy();

    fireEvent.press(screen.getByText('dark'));
    expect(screen.getByText('mode:dark')).toBeTruthy();
    expect(screen.getByText('resolved:dark')).toBeTruthy();

    fireEvent.press(screen.getByText('light'));
    expect(screen.getByText('mode:light')).toBeTruthy();
    expect(screen.getByText('resolved:light')).toBeTruthy();
  });
});
