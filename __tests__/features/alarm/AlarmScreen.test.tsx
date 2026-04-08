import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { AlarmScreen } from '../../../src/features/alarm/AlarmScreen';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import {
  createInitialSharedDocument,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
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
  beforeEach(() => {
    jest.useRealTimers();
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
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <AlarmScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Alarm')).toBeTruthy();
    expect(screen.getByText('Unlock Required')).toBeTruthy();
    expect(screen.getByText('Timer')).toBeTruthy();
    expect(screen.getByText('Readiness')).toBeTruthy();

    fireEvent.press(screen.getByText('Unlock with PIN'));
    expect(mockPush).toHaveBeenCalledWith('/parent-unlock');
  });

  it('renders live timer controls and normalizes settings input when unlocked', () => {
    render(
      <SharedStoreProvider
        initialDocument={createInitialSharedDocument({
          deviceId: 'alarm-unlocked',
        })}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <AlarmScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByLabelText('Alarm start timer')).toBeTruthy();
    expect(
      screen.getByText(/(JS bridge pending|integration pending)/),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Alarm start timer'));
    expect(screen.getAllByText('Running').length).toBeGreaterThan(0);

    const intervalMinutesInput = screen.getByLabelText('Interval minutes');
    const intervalSecondsInput = screen.getByLabelText('Interval seconds');
    const alarmDurationInput = screen.getByLabelText('Alarm duration seconds');

    fireEvent.changeText(intervalMinutesInput, '0');
    fireEvent.changeText(intervalSecondsInput, '0');
    fireEvent(intervalSecondsInput, 'blur');

    expect(screen.getByLabelText('Interval minutes').props.value).toBe('0');
    expect(screen.getByLabelText('Interval seconds').props.value).toBe('1');

    fireEvent.changeText(alarmDurationInput, '0');
    fireEvent(alarmDurationInput, 'blur');

    expect(screen.getByLabelText('Alarm duration seconds').props.value).toBe(
      '1',
    );
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
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <AlarmScreen />
          </AppThemeProvider>
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
