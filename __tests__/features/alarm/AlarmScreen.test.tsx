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

jest.mock('../../../src/features/app/alarmEngine', () => ({
  isAlarmEngineAvailable: jest.fn(() => true),
  openExactAlarmSettings: jest.fn(async () => undefined),
  openFullScreenIntentSettings: jest.fn(async () => undefined),
  openNotificationSettings: jest.fn(async () => undefined),
  openPromotedNotificationSettings: jest.fn(async () => undefined),
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
      alarmRuntimeStatus: {
        countdownNotificationChannelImportance: null,
        countdownNotificationHasPromotableCharacteristics: false,
        countdownNotificationIsOngoing: false,
        countdownNotificationRequestedPromoted: false,
        countdownNotificationUsesChronometer: false,
        countdownNotificationWhen: null,
        exactAlarmPermissionGranted: false,
        expiredNotificationCategory: null,
        expiredNotificationChannelImportance: null,
        expiredNotificationHasCustomHeadsUp: false,
        expiredNotificationHasFullScreenIntent: false,
        fullScreenIntentPermissionGranted: false,
        fullScreenIntentSettingsResolvable: false,
        isAppInForeground: false,
        isRunning: false,
        lastTriggeredAt: null,
        nextTriggerAt: null,
        notificationPermissionGranted: false,
        promotedNotificationSettingsResolvable: false,
        promotedNotificationPermissionGranted: false,
        sessionId: null,
      },
      appData: {
        expiredIntervals: [],
        timerConfig: {
          intervalMinutes: 15,
          intervalSeconds: 0,
          notificationsEnabled: true,
          alarmSound: 'Chime',
          alarmDurationSeconds: 20,
        },
      },
      awardExpiredIntervalChild: jest.fn(),
      dismissExpiredIntervalChild: jest.fn(),
      isHydrated: true,
      parentSession: {
        isUnlocked: false,
      },
      pauseTimer: jest.fn(),
      refreshAlarmRuntimeStatus: jest.fn(async () => undefined),
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
      alarmRuntimeStatus: {
        countdownNotificationChannelImportance: null,
        countdownNotificationHasPromotableCharacteristics: false,
        countdownNotificationIsOngoing: false,
        countdownNotificationRequestedPromoted: false,
        countdownNotificationUsesChronometer: false,
        countdownNotificationWhen: null,
        exactAlarmPermissionGranted: false,
        expiredNotificationCategory: null,
        expiredNotificationChannelImportance: null,
        expiredNotificationHasCustomHeadsUp: false,
        expiredNotificationHasFullScreenIntent: false,
        fullScreenIntentPermissionGranted: false,
        fullScreenIntentSettingsResolvable: false,
        isAppInForeground: false,
        isRunning: false,
        lastTriggeredAt: null,
        nextTriggerAt: null,
        notificationPermissionGranted: false,
        promotedNotificationSettingsResolvable: false,
        promotedNotificationPermissionGranted: false,
        sessionId: null,
      },
      appData: {
        expiredIntervals: [],
        timerConfig: {
          intervalMinutes: 15,
          intervalSeconds: 0,
          notificationsEnabled: true,
          alarmSound: 'Chime',
          alarmDurationSeconds: 20,
        },
      },
      awardExpiredIntervalChild: jest.fn(),
      dismissExpiredIntervalChild: jest.fn(),
      isHydrated: true,
      parentSession: {
        isUnlocked: true,
      },
      pauseTimer: jest.fn(),
      refreshAlarmRuntimeStatus: jest.fn(async () => undefined),
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
    expect(view.getByText('Settings')).toBeTruthy();
    expect(view.getByText('Notifications')).toBeTruthy();
    expect(view.getByText('Minutes')).toBeTruthy();
    expect(view.getByText('Seconds')).toBeTruthy();
    expect(view.queryByText('Alarm sound')).toBeNull();
    expect(view.queryByText('Current cycle')).toBeNull();
    expect(view.queryByText('Interval settings')).toBeNull();
    expect(view.queryByText('Notification placeholders')).toBeNull();
    expect(view.queryByText('Engine')).toBeNull();
    expect(view.queryByText('show debug status')).toBeNull();

    fireEvent.press(view.getByText('Notifications'));

    expect(view.getByText('show debug status')).toBeTruthy();
    expect(view.queryByText('Engine')).toBeNull();
    expect(view.queryByText('Exact alarms')).toBeNull();
    expect(view.queryByText('Alarm popup')).toBeNull();
    expect(view.queryByText('Live updates')).toBeNull();
    expect(
      view.getByText("Timer expiry uses your device's system alarm sound."),
    ).toBeTruthy();

    fireEvent.press(view.getByText('show debug status'));

    expect(view.queryByText('show debug status')).toBeNull();
    expect(view.getByText('Engine')).toBeTruthy();
    expect(view.getAllByText('Exact alarms').length).toBeGreaterThan(1);
    expect(view.getAllByText('Alarm popup').length).toBeGreaterThan(1);
    expect(view.getAllByText('Live updates').length).toBeGreaterThan(1);

    fireEvent.press(view.getByText('Start'));
    fireEvent.press(view.getByText('Reset'));

    expect(startTimer).toHaveBeenCalled();
    expect(resetTimer).toHaveBeenCalled();
  });
});
