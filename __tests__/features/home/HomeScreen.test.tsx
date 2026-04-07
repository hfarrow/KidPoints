import { fireEvent, render, screen } from '@testing-library/react-native';

import { HomeScreen } from '../../../src/features/home/HomeScreen';
import { ShellSessionProvider } from '../../../src/features/shell/shellContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';

const mockPush = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const mockReactNative = jest.requireActual('react-native');
  const { Text } = mockReactNative;

  function MockIcon() {
    return <Text>icon</Text>;
  }

  return {
    Feather: MockIcon,
    Ionicons: MockIcon,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('HomeScreen', () => {
  it('renders shell tiles and opens supporting surfaces', () => {
    render(
      <ShellSessionProvider initialParentUnlocked>
        <AppThemeProvider initialThemeMode="light">
          <HomeScreen />
        </AppThemeProvider>
      </ShellSessionProvider>,
    );

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Check-In')).toBeTruthy();
    expect(screen.getByText('Add Child')).toBeTruthy();
    expect(screen.getByText('Add a child to get started!')).toBeTruthy();
    expect(screen.getByText('Parent')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Open settings'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});
