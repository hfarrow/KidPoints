import { fireEvent, render, screen } from '@testing-library/react-native';

import { AlarmScreen } from '../../../src/features/alarm/AlarmScreen';
import { ShellSessionProvider } from '../../../src/features/shell/shellContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

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

describe('AlarmScreen', () => {
  it('renders the locked shell state and opens the unlock flow', () => {
    render(
      <ShellSessionProvider initialParentUnlocked={false}>
        <AppThemeProvider
          initialThemeMode="light"
          storage={createMemoryStorage()}
        >
          <AlarmScreen />
        </AppThemeProvider>
      </ShellSessionProvider>,
    );

    expect(screen.getByText('Alarm')).toBeTruthy();
    expect(screen.getByText('Unlock required')).toBeTruthy();

    fireEvent.press(screen.getByText('Unlock with PIN'));
    expect(mockPush).toHaveBeenCalledWith('/parent-unlock');
  });
});
