import { fireEvent, render, screen } from '@testing-library/react-native';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { SettingsScreen } from '../../../src/features/settings/SettingsScreen';
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
  beforeEach(() => {
    mockBack.mockReset();
    mockPush.mockReset();
  });

  it('shows Unlock in the locked state and opens the parent modal', () => {
    render(
      <ParentSessionProvider initialParentUnlocked={false}>
        <AppThemeProvider
          initialThemeMode="light"
          storage={createMemoryStorage()}
        >
          <SettingsScreen />
        </AppThemeProvider>
      </ParentSessionProvider>,
    );

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByLabelText('Go Back')).toBeTruthy();
    expect(screen.getByText('Unlock')).toBeTruthy();
    expect(screen.queryByText('Archived Children')).toBeNull();

    fireEvent.press(screen.getByText('Unlock'));
    expect(mockPush).toHaveBeenCalledWith('/parent-unlock');

    fireEvent.press(screen.getByLabelText('Go Back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows Lock in the unlocked state and does not route away', () => {
    render(
      <ParentSessionProvider initialParentUnlocked>
        <AppThemeProvider
          initialThemeMode="light"
          storage={createMemoryStorage()}
        >
          <SettingsScreen />
        </AppThemeProvider>
      </ParentSessionProvider>,
    );

    fireEvent.press(screen.getByText('Lock'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows and updates the active app log level', () => {
    render(
      <ParentSessionProvider initialParentUnlocked={false}>
        <AppThemeProvider
          initialThemeMode="light"
          storage={createMemoryStorage()}
        >
          <SettingsScreen />
        </AppThemeProvider>
      </ParentSessionProvider>,
    );

    expect(screen.getByText('Debug')).toBeTruthy();
    expect(screen.getAllByText('debug')).toHaveLength(2);

    fireEvent.press(screen.getByText('error'));

    expect(screen.getAllByText('error')).toHaveLength(2);
  });
});
