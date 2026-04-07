import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsScreen } from '../../../src/features/settings/SettingsScreen';
import { ShellSessionProvider } from '../../../src/features/shell/shellContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockBack = jest.fn();
const mockPush = jest.fn();

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

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

describe('SettingsScreen', () => {
  it('renders as a screen and links to the routed management surfaces', () => {
    render(
      <ShellSessionProvider initialParentUnlocked={false}>
        <AppThemeProvider
          initialThemeMode="light"
          storage={createMemoryStorage()}
        >
          <SettingsScreen />
        </AppThemeProvider>
      </ShellSessionProvider>,
    );

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Display mode')).toBeTruthy();
    expect(screen.getByLabelText('Go back')).toBeTruthy();

    fireEvent.press(screen.getByText('Archived children'));
    expect(mockPush).toHaveBeenCalledWith('/list-browser');

    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
