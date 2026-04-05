import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { AlarmScreen } from '../../../src/features/alarm/AlarmScreen';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('../../../src/features/app/appStorage', () => ({
  useAppStorage: jest.fn(),
}));

const { useAppStorage } = jest.requireMock(
  '../../../src/features/app/appStorage',
) as {
  useAppStorage: jest.Mock;
};

describe('AlarmScreen', () => {
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
});
