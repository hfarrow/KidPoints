import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';

import RootLayout, { AlarmPermissionBootstrap } from '../../app/_layout';
import type { AlarmEngineRuntimeStatus } from '../../src/features/app/alarmEngine';

const mockAddAlarmLaunchActionListener = jest.fn();
const mockConsumePendingAlarmLaunchAction = jest.fn<
  () => Promise<{
    intervalId: string | null;
    notificationId: number | null;
    sessionId: string | null;
    triggeredAt: number | null;
    type: 'check-in';
  } | null>
>(async () => null);
const mockRefreshAlarmRuntimeStatus = jest.fn(async () => undefined);
const mockUseAppStorage = jest.fn();
const mockGetAlarmRuntimeStatus =
  jest.fn<() => Promise<AlarmEngineRuntimeStatus>>();
const mockIsAlarmEngineAvailable = jest.fn();
const mockOpenExactAlarmSettings = jest.fn(async () => undefined);
const mockOpenPromotedNotificationSettings = jest.fn(async () => undefined);
const mockStopExpiredAlarmPlayback = jest.fn(async () => undefined);
let alarmLaunchActionListener:
  | ((action: {
      intervalId: string | null;
      notificationId: number | null;
      sessionId: string | null;
      triggeredAt: number | null;
      type: 'check-in';
    }) => void)
  | null = null;

jest.mock('expo-router', () => ({
  Stack: Object.assign(({ children }: { children: ReactNode }) => children, {
    Screen: () => null,
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
    MaterialIcons: createIcon('MaterialIconsIcon'),
  };
});

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('../../src/features/app/appStorage', () => ({
  AppStorageProvider: ({ children }: { children: ReactNode }) => children,
  useAppStorage: () => mockUseAppStorage(),
}));

jest.mock('../../src/features/app/alarmEngine', () => ({
  addAlarmLaunchActionListener: (...args: unknown[]) =>
    mockAddAlarmLaunchActionListener(...args),
  consumePendingAlarmLaunchAction: () => mockConsumePendingAlarmLaunchAction(),
  getAlarmRuntimeStatus: () => mockGetAlarmRuntimeStatus(),
  isAlarmEngineAvailable: () => mockIsAlarmEngineAvailable(),
  openExactAlarmSettings: () => mockOpenExactAlarmSettings(),
  openFullScreenIntentSettings: jest.fn(async () => undefined),
  openPromotedNotificationSettings: () =>
    mockOpenPromotedNotificationSettings(),
  stopExpiredAlarmPlayback: () => mockStopExpiredAlarmPlayback(),
}));

jest.mock('../../src/features/theme/themeContext', () => ({
  AppThemeProvider: ({ children }: { children: ReactNode }) => children,
  useAppTheme: () => ({
    statusBarStyle: 'dark',
    tokens: {
      border: '#cbd5e1',
      controlSurface: '#e2e8f0',
      controlText: '#0f172a',
      inputSurface: '#f8fafc',
      modalBackdrop: 'rgba(15, 23, 42, 0.55)',
      modalSurface: '#ffffff',
      textMuted: '#475569',
      textPrimary: '#0f172a',
    },
  }),
}));

describe('AlarmPermissionBootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest
      .spyOn(Linking, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue('granted' as never);
    alarmLaunchActionListener = null;
    mockAddAlarmLaunchActionListener.mockImplementation((listener) => {
      alarmLaunchActionListener = listener as typeof alarmLaunchActionListener;
      return {
        remove: jest.fn(() => {
          alarmLaunchActionListener = null;
        }),
      };
    });
    mockConsumePendingAlarmLaunchAction.mockResolvedValue(null);
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      value: 34,
    });

    mockUseAppStorage.mockReturnValue({
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
        timerConfig: {
          alarmDurationSeconds: 20,
          alarmSound: 'Chime',
          intervalMinutes: 15,
          intervalSeconds: 0,
          notificationsEnabled: true,
        },
      },
      isHydrated: true,
      reloadPersistedState: mockRefreshAlarmRuntimeStatus,
      refreshAlarmRuntimeStatus: mockRefreshAlarmRuntimeStatus,
    });
    mockGetAlarmRuntimeStatus.mockResolvedValue({
      countdownNotificationChannelImportance: 2,
      countdownNotificationHasPromotableCharacteristics: true,
      countdownNotificationIsOngoing: true,
      countdownNotificationRequestedPromoted: true,
      countdownNotificationUsesChronometer: true,
      countdownNotificationWhen: 1_000,
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
      notificationPermissionGranted: true,
      promotedNotificationSettingsResolvable: true,
      promotedNotificationPermissionGranted: true,
      sessionId: null,
    });
    mockIsAlarmEngineAvailable.mockReturnValue(true);
  });

  it('requests notifications and explains exact alarm settings on launch', async () => {
    render(<AlarmPermissionBootstrap />);

    await waitFor(() => {
      expect(PermissionsAndroid.request).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Enable exact alarms',
        expect.stringContaining('KidPoints will open Android settings'),
        expect.any(Array),
      );
    });
  });

  it('skips startup prompts when notifications were disabled in app settings', async () => {
    mockUseAppStorage.mockReturnValue({
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
        timerConfig: {
          alarmDurationSeconds: 20,
          alarmSound: 'Chime',
          intervalMinutes: 15,
          intervalSeconds: 0,
          notificationsEnabled: false,
        },
      },
      isHydrated: true,
      reloadPersistedState: mockRefreshAlarmRuntimeStatus,
      refreshAlarmRuntimeStatus: mockRefreshAlarmRuntimeStatus,
    });

    render(<AlarmPermissionBootstrap />);

    await waitFor(() => {
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    });

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('renders the expired interval review modal globally after a check-in launch action', async () => {
    const awardExpiredIntervalChild = jest.fn();
    const dismissExpiredIntervalChild = jest.fn();
    const resetTimer = jest.fn();
    const reloadPersistedState = jest.fn(async () => undefined);

    mockConsumePendingAlarmLaunchAction.mockResolvedValue({
      intervalId: 'interval-1',
      notificationId: 5010,
      sessionId: 'session-1',
      triggeredAt: 1_000,
      type: 'check-in' as const,
    });

    mockUseAppStorage.mockReturnValue({
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
        expiredIntervals: [
          {
            childActions: [
              {
                childId: 'child-1',
                childName: 'Ava',
                status: 'pending',
              },
            ],
            intervalId: 'interval-1',
            notificationId: 5010,
            sessionId: 'session-1',
            triggeredAt: 1_000,
          },
        ],
        timerConfig: {
          alarmDurationSeconds: 20,
          alarmSound: 'Chime',
          intervalMinutes: 15,
          intervalSeconds: 0,
          notificationsEnabled: true,
        },
      },
      awardExpiredIntervalChild,
      dismissExpiredIntervalChild,
      isHydrated: true,
      reloadPersistedState,
      refreshAlarmRuntimeStatus: mockRefreshAlarmRuntimeStatus,
      resetTimer,
    });

    const view = render(<RootLayout />);

    await waitFor(() => {
      expect(view.getByText('Timer complete')).toBeTruthy();
    });

    fireEvent.press(view.getByLabelText('Award Ava'));
    fireEvent.press(view.getByLabelText('Dismiss Ava'));
    fireEvent.press(view.getByText('Stop timer'));

    expect(mockStopExpiredAlarmPlayback).toHaveBeenCalled();
    expect(reloadPersistedState).toHaveBeenCalled();
    expect(awardExpiredIntervalChild).toHaveBeenCalledWith(
      'interval-1',
      'child-1',
    );
    expect(dismissExpiredIntervalChild).toHaveBeenCalledWith(
      'interval-1',
      'child-1',
    );
    expect(resetTimer).toHaveBeenCalled();
  });

  it('reloads persisted state when a pending native check-in action is consumed after hydration', async () => {
    const reloadPersistedState = jest.fn(async () => undefined);

    mockConsumePendingAlarmLaunchAction.mockResolvedValue({
      intervalId: 'interval-1',
      notificationId: 5010,
      sessionId: 'session-1',
      triggeredAt: 1_000,
      type: 'check-in' as const,
    });

    mockUseAppStorage.mockReturnValue({
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
          alarmDurationSeconds: 20,
          alarmSound: 'Chime',
          intervalMinutes: 15,
          intervalSeconds: 0,
          notificationsEnabled: true,
        },
      },
      isHydrated: true,
      reloadPersistedState,
      refreshAlarmRuntimeStatus: mockRefreshAlarmRuntimeStatus,
    });

    render(<RootLayout />);

    await waitFor(() => {
      expect(mockConsumePendingAlarmLaunchAction).toHaveBeenCalled();
      expect(reloadPersistedState).toHaveBeenCalled();
    });
  });

  it('opens the check-in modal from a live native launch action event even when persisted recovery is empty', async () => {
    const reloadPersistedState = jest.fn(async () => undefined);
    mockConsumePendingAlarmLaunchAction.mockResolvedValue(null);

    mockUseAppStorage.mockReturnValue({
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
        expiredIntervals: [
          {
            childActions: [
              {
                childId: 'child-1',
                childName: 'Ava',
                status: 'pending',
              },
            ],
            intervalId: 'interval-1',
            notificationId: 5010,
            sessionId: 'session-1',
            triggeredAt: 1_000,
          },
        ],
        timerConfig: {
          alarmDurationSeconds: 20,
          alarmSound: 'Chime',
          intervalMinutes: 15,
          intervalSeconds: 0,
          notificationsEnabled: true,
        },
      },
      isHydrated: true,
      reloadPersistedState,
      refreshAlarmRuntimeStatus: mockRefreshAlarmRuntimeStatus,
    });

    const view = render(<RootLayout />);

    await waitFor(() => {
      expect(alarmLaunchActionListener).toBeTruthy();
    });

    await waitFor(() => {
      expect(mockConsumePendingAlarmLaunchAction).toHaveBeenCalledTimes(1);
    });

    mockConsumePendingAlarmLaunchAction.mockClear();
    reloadPersistedState.mockClear();
    mockStopExpiredAlarmPlayback.mockClear();

    await act(async () => {
      alarmLaunchActionListener?.({
        intervalId: 'interval-1',
        notificationId: 5010,
        sessionId: 'session-1',
        triggeredAt: 1_000,
        type: 'check-in',
      });
    });

    await waitFor(() => {
      expect(view.getByText('Timer complete')).toBeTruthy();
    });

    expect(mockStopExpiredAlarmPlayback).toHaveBeenCalled();
    expect(reloadPersistedState).not.toHaveBeenCalled();
  });

  it('reloads persisted state when launched from a check-in deep link', async () => {
    const reloadPersistedState = jest.fn(async () => undefined);

    jest
      .spyOn(Linking, 'getInitialURL')
      .mockResolvedValue('kidpoints://?checkIn=1');

    mockUseAppStorage.mockReturnValue({
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
          alarmDurationSeconds: 20,
          alarmSound: 'Chime',
          intervalMinutes: 15,
          intervalSeconds: 0,
          notificationsEnabled: true,
        },
      },
      isHydrated: true,
      reloadPersistedState,
      refreshAlarmRuntimeStatus: mockRefreshAlarmRuntimeStatus,
    });

    render(<RootLayout />);

    await waitFor(() => {
      expect(reloadPersistedState).toHaveBeenCalled();
    });
  });

  it('explains alarm popup settings when exact alarms are already allowed', async () => {
    mockGetAlarmRuntimeStatus.mockResolvedValue({
      countdownNotificationChannelImportance: 2,
      countdownNotificationHasPromotableCharacteristics: true,
      countdownNotificationIsOngoing: true,
      countdownNotificationRequestedPromoted: true,
      countdownNotificationUsesChronometer: true,
      countdownNotificationWhen: 1_000,
      exactAlarmPermissionGranted: true,
      expiredNotificationCategory: null,
      expiredNotificationChannelImportance: null,
      expiredNotificationHasCustomHeadsUp: false,
      expiredNotificationHasFullScreenIntent: false,
      fullScreenIntentPermissionGranted: false,
      fullScreenIntentSettingsResolvable: true,
      isAppInForeground: false,
      isRunning: false,
      lastTriggeredAt: null,
      nextTriggerAt: null,
      notificationPermissionGranted: true,
      promotedNotificationSettingsResolvable: true,
      promotedNotificationPermissionGranted: false,
      sessionId: null,
    });

    render(<AlarmPermissionBootstrap />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Enable alarm popup',
        expect.stringContaining('full alarm alert'),
        expect.any(Array),
      );
    });
  });

  it('explains live update settings after alarm popup access is already allowed', async () => {
    mockGetAlarmRuntimeStatus.mockResolvedValue({
      countdownNotificationChannelImportance: 2,
      countdownNotificationHasPromotableCharacteristics: true,
      countdownNotificationIsOngoing: true,
      countdownNotificationRequestedPromoted: true,
      countdownNotificationUsesChronometer: true,
      countdownNotificationWhen: 1_000,
      exactAlarmPermissionGranted: true,
      expiredNotificationCategory: null,
      expiredNotificationChannelImportance: null,
      expiredNotificationHasCustomHeadsUp: false,
      expiredNotificationHasFullScreenIntent: false,
      fullScreenIntentPermissionGranted: true,
      fullScreenIntentSettingsResolvable: true,
      isAppInForeground: false,
      isRunning: false,
      lastTriggeredAt: null,
      nextTriggerAt: null,
      notificationPermissionGranted: true,
      promotedNotificationSettingsResolvable: true,
      promotedNotificationPermissionGranted: false,
      sessionId: null,
    });

    render(<AlarmPermissionBootstrap />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Enable live updates',
        expect.stringContaining('Live Update chip'),
        expect.any(Array),
      );
    });
  });

  it('skips the alarm popup prompt when the system build does not expose full-screen intent settings', async () => {
    mockGetAlarmRuntimeStatus.mockResolvedValue({
      countdownNotificationChannelImportance: 2,
      countdownNotificationHasPromotableCharacteristics: true,
      countdownNotificationIsOngoing: true,
      countdownNotificationRequestedPromoted: true,
      countdownNotificationUsesChronometer: true,
      countdownNotificationWhen: 1_000,
      exactAlarmPermissionGranted: true,
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
      notificationPermissionGranted: true,
      promotedNotificationSettingsResolvable: false,
      promotedNotificationPermissionGranted: false,
      sessionId: null,
    });

    render(<AlarmPermissionBootstrap />);

    await waitFor(() => {
      expect(Alert.alert).not.toHaveBeenCalledWith(
        'Enable alarm popup',
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
