import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AlarmScreen } from '../../../src/features/alarm/AlarmScreen';
import { getThemeTokens } from '../../../src/features/theme/theme';

const mockReplace = jest.fn();
const mockUseAppTheme = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  const createIcon = (displayName: string) => {
    const Icon = ({ name, ...props }: { name: string; children?: ReactNode }) =>
      React.createElement(
        Text,
        { ...props, accessibilityLabel: name },
        displayName,
      );

    Icon.displayName = displayName;

    return Icon;
  };

  return {
    Feather: createIcon('FeatherIcon'),
    Ionicons: createIcon('IoniconsIcon'),
    MaterialIcons: createIcon('MaterialIconsIcon'),
  };
});

jest.mock('../../../src/features/app/appStorage', () => ({
  useAppStorage: jest.fn(),
}));

jest.mock('../../../src/features/theme/themeContext', () => ({
  useAppTheme: () => mockUseAppTheme(),
  useThemedStyles: (factory: (theme: unknown) => unknown) =>
    factory(mockUseAppTheme()),
}));

const { useAppStorage } = jest.requireMock(
  '../../../src/features/app/appStorage',
) as {
  useAppStorage: jest.Mock;
};

describe('AlarmScreen', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockUseAppTheme.mockReset();
    mockUseAppTheme.mockReturnValue({
      getScreenSurface: jest.fn(() => '#ffffff'),
      resolvedTheme: 'light',
      setThemeMode: jest.fn(),
      statusBarStyle: 'dark',
      themeMode: 'system',
      tokens: getThemeTokens('light'),
    });
  });

  it('redirects to home when parent mode is locked', () => {
    useAppStorage.mockReturnValue({
      appData: {
        timerConfig: {
          intervalMinutes: 15,
          notificationsEnabled: true,
          alarmSound: 'Chime',
          alarmDurationSeconds: 20,
        },
      },
      isHydrated: true,
      parentSession: {
        isUnlocked: false,
      },
      pauseTimer: jest.fn(),
      resetTimer: jest.fn(),
      startTimer: jest.fn(),
      timerSnapshot: {
        currentCycleStartedAt: null,
        isRunning: false,
        nextTriggerAt: null,
        remainingMs: 900_000,
      },
      updateTimerConfig: jest.fn(),
    });

    render(<AlarmScreen />);

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('renders the shared alarm tile and keeps timer settings below it', () => {
    const startTimer = jest.fn();
    const resetTimer = jest.fn();

    useAppStorage.mockReturnValue({
      appData: {
        timerConfig: {
          intervalMinutes: 15,
          notificationsEnabled: true,
          alarmSound: 'Chime',
          alarmDurationSeconds: 20,
        },
      },
      isHydrated: true,
      parentSession: {
        isUnlocked: true,
      },
      pauseTimer: jest.fn(),
      resetTimer,
      startTimer,
      timerSnapshot: {
        currentCycleStartedAt: null,
        isRunning: false,
        nextTriggerAt: null,
        remainingMs: 900_000,
      },
      updateTimerConfig: jest.fn(),
    });

    const view = render(<AlarmScreen />);

    expect(view.getAllByText('Alarm')).toHaveLength(2);
    expect(view.getByText('15:00')).toBeTruthy();
    expect(view.getByText('Interval settings')).toBeTruthy();
    expect(view.queryByText('Current cycle')).toBeNull();

    fireEvent.press(view.getByText('Start'));
    fireEvent.press(view.getByText('Reset'));

    expect(startTimer).toHaveBeenCalled();
    expect(resetTimer).toHaveBeenCalled();
  });
});
