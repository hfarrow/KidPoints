import { render } from '@testing-library/react-native';

import { Tile } from '../../src/components/Tile';
import { AppThemeProvider } from '../../src/features/theme/themeContext';
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
      <AppThemeProvider
        initialThemeMode="light"
        storage={createMemoryStorage()}
      >
        <Tile collapsible initiallyCollapsed title="Parent" />
      </AppThemeProvider>,
    );

    expect(toJSON()).toMatchObject({
      children: [expect.any(Object)],
    });
  });
});
