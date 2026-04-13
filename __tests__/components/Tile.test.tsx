import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { Tile } from '../../src/components/Tile';
import { AppSettingsProvider } from '../../src/features/settings/appSettingsContext';
import { createMemoryStorage } from '../testUtils/memoryStorage';

jest.mock('@expo/vector-icons', () => {
  const mockReactNative = jest.requireActual('react-native');
  const { Text } = mockReactNative;

  function MockIcon() {
    return <Text>icon</Text>;
  }

  return {
    Feather: MockIcon,
  };
});

describe('Tile', () => {
  it('does not render an empty content container for collapsed header-only tiles', () => {
    const { toJSON } = render(
      <AppSettingsProvider
        initialThemeMode="light"
        storage={createMemoryStorage()}
      >
        <Tile collapsible initiallyCollapsed title="Parent" />
      </AppSettingsProvider>,
    );

    expect(toJSON()).toMatchObject({
      children: [expect.any(Object)],
    });
  });

  it('can hide the header row while still rendering summary content', () => {
    render(
      <AppSettingsProvider
        initialThemeMode="light"
        storage={createMemoryStorage()}
      >
        <Tile headerHidden summary={<Text>15:00</Text>} title="Countdown" />
      </AppSettingsProvider>,
    );

    expect(screen.queryByText('Countdown')).toBeNull();
    expect(screen.getByText('15:00')).toBeTruthy();
  });

  it('keeps compact header-hidden tile padding visually centered', () => {
    render(
      <AppSettingsProvider
        initialThemeMode="light"
        storage={createMemoryStorage()}
      >
        <Tile
          density="extraCompact"
          headerHidden
          summary={<Text>15:00</Text>}
          testID="countdown-tile"
          title="Countdown"
        />
      </AppSettingsProvider>,
    );

    const tileStyle = StyleSheet.flatten(
      screen.getByTestId('countdown-tile').props.style,
    );

    expect(tileStyle.paddingTop).toBe(8);
    expect(tileStyle.paddingBottom).toBe(8);
  });
});
