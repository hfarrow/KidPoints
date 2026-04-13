import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';

import { AlarmScreen } from '../../../src/features/alarm/AlarmScreen';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import {
  createInitialSharedDocument,
  SharedStoreProvider,
  useSharedStore,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockNavigate = jest.fn();
const mockUseNotifications = jest.fn();
const mockRequestTimerStart = jest.fn(async () => undefined);
let startTimerBridge: (() => void) | null = null;

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
    navigate: mockNavigate,
  }),
}));

jest.mock('../../../src/features/notifications/NotificationsProvider', () => ({
  useNotifications: () => mockUseNotifications(),
}));

function StoreStartTimerBridge() {
  const startTimer = useSharedStore((state) => state.startTimer);

  useEffect(() => {
    startTimerBridge = () => {
      startTimer();
    };

    return () => {
      startTimerBridge = null;
    };
  }, [startTimer]);

  return null;
}

describe('AlarmScreen', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockNavigate.mockReset();
    mockRequestTimerStart.mockReset();
    mockRequestTimerStart.mockImplementation(async () => {
      startTimerBridge?.();
    });
    mockUseNotifications.mockReturnValue({
      activeExpiredTimerSession: null,
      dismissCheckInFlow: jest.fn(),
      engineAvailable: true,
      isReady: true,
      liveCountdownNotificationsEnabled: true,
      openExactAlarmSettings: jest.fn(),
      openFullScreenIntentSettings: jest.fn(),
      openNotificationSettings: jest.fn(),
      openPromotedNotificationSettings: jest.fn(),
      refreshRuntimeStatus: jest.fn(),
      requestTimerStart: mockRequestTimerStart,
      resolveExpiredTimerChild: jest.fn(),
      runtimeStatus: {
        countdownNotificationChannelImportance: 2,
        countdownNotificationHasPromotableCharacteristics: true,
        countdownNotificationIsOngoing: false,
        countdownNotificationRequestedPromoted: true,
        countdownNotificationUsesChronometer: true,
        countdownNotificationWhen: null,
        exactAlarmPermissionGranted: true,
        expiredNotificationCategory: 'alarm',
        expiredNotificationChannelImportance: 4,
        expiredNotificationHasCustomHeadsUp: true,
        expiredNotificationHasFullScreenIntent: true,
        fullScreenIntentPermissionGranted: true,
        fullScreenIntentSettingsResolvable: true,
        isAppInForeground: true,
        isRunning: false,
        lastTriggeredAt: null,
        nextTriggerAt: null,
        notificationPermissionGranted: true,
        promotedNotificationPermissionGranted: true,
        promotedNotificationSettingsResolvable: true,
        sessionId: null,
      },
      setLiveCountdownNotificationsEnabled: jest.fn(),
    });
  });

  it('renders the locked parent-gated state and opens the unlock flow', () => {
    render(
      <SharedStoreProvider
        initialDocument={createInitialSharedDocument({
          deviceId: 'alarm-locked',
        })}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked={false}>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <StoreStartTimerBridge />
            <AlarmScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Alarm')).toBeTruthy();
    expect(screen.getByText('Unlock Required')).toBeTruthy();
    expect(screen.queryByText('Countdown')).toBeNull();
    expect(screen.getByLabelText(/Countdown Ready/)).toBeTruthy();
    expect(screen.queryByText('15m cadence')).toBeNull();
    expect(screen.queryByText('20s alarm')).toBeNull();
    expect(screen.getByText('Live Countdown')).toBeTruthy();
    expect(screen.queryByText('Readiness')).toBeNull();

    fireEvent.press(screen.getByText('Unlock with PIN'));
    expect(mockNavigate).toHaveBeenCalledWith('/parent-unlock');
  });

  it('renders live timer controls and expands notifications diagnostics on demand', () => {
    render(
      <SharedStoreProvider
        initialDocument={createInitialSharedDocument({
          deviceId: 'alarm-unlocked',
        })}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <StoreStartTimerBridge />
            <AlarmScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.queryByText('Countdown')).toBeNull();
    expect(screen.getByLabelText(/Countdown Ready/)).toBeTruthy();
    expect(screen.queryByText('15m cadence')).toBeNull();
    expect(screen.queryByText('20s alarm')).toBeNull();
    expect(screen.getByLabelText('Alarm start timer')).toBeTruthy();
    expect(screen.getByText('Live Countdown')).toBeTruthy();
    expect(screen.queryByText('Runtime')).toBeNull();

    fireEvent.press(screen.getByLabelText('Expand Notifications'));

    expect(screen.getByText('Readiness')).toBeTruthy();
    expect(screen.getByText('Runtime')).toBeTruthy();
    expect(screen.getAllByText('Lock Screen Popup').length).toBeGreaterThan(0);
    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getAllByText('Allowed').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByLabelText('Alarm start timer'));
    expect(mockRequestTimerStart).toHaveBeenCalledWith('alarm');
    expect(screen.getByLabelText(/Countdown Running/)).toBeTruthy();

    const intervalMinutesInput = screen.getByLabelText('Interval minutes');
    const intervalSecondsInput = screen.getByLabelText('Interval seconds');
    const alarmDurationInput = screen.getByLabelText('Mute after seconds');

    fireEvent.changeText(intervalMinutesInput, '0');
    fireEvent.changeText(intervalSecondsInput, '0');
    fireEvent(intervalSecondsInput, 'blur');

    expect(screen.getByLabelText('Interval minutes').props.value).toBe('0');
    expect(screen.getByLabelText('Interval seconds').props.value).toBe('1');

    fireEvent.changeText(alarmDurationInput, '0');
    fireEvent(alarmDurationInput, 'blur');

    expect(screen.getByLabelText('Mute after seconds').props.value).toBe('1');
  });

  it('does not flash a longer countdown when resuming from pause', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-07T12:00:00.000Z'));

    render(
      <SharedStoreProvider
        initialDocument={createInitialSharedDocument({
          deviceId: 'alarm-resume-glitch',
        })}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <StoreStartTimerBridge />
            <AlarmScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    fireEvent.press(screen.getByLabelText('Alarm start timer'));

    act(() => {
      jest.advanceTimersByTime(61_000);
    });

    fireEvent.press(screen.getByLabelText('Alarm pause timer'));

    act(() => {
      jest.advanceTimersByTime(10 * 60_000);
    });

    fireEvent.press(screen.getByLabelText('Alarm start timer'));

    expect(screen.queryByText('15:00')).toBeNull();
    expect(screen.getByText('13:59')).toBeTruthy();
  });
});
