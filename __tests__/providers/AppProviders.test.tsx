import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, Text } from 'react-native';

import { AppProviders } from '../../src/providers/AppProviders';

jest.mock('../../src/features/backup/BackupProvider', () => ({
  BackupProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('../../src/logging/logger', () => {
  const mockLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    temp: jest.fn(),
    warn: jest.fn(),
  };

  return {
    __mockLogger: mockLogger,
    createModuleLogger: jest.fn(() => mockLogger),
    createStructuredLog: jest.fn((loggerInstance, level, message) => {
      return (details = {}) => {
        loggerInstance[level](message, details);
      };
    }),
    getAppLogLevel: jest.fn(() => 'debug'),
    getDefaultAppLogLevel: jest.fn(() => 'debug'),
    normalizeAppLogLevel: jest.fn((logLevel) => logLevel ?? 'debug'),
    setAppLogLevel: jest.fn(),
  };
});

const {
  __mockLogger: mockLogger,
  normalizeAppLogLevel,
  setAppLogLevel,
} = jest.requireMock('../../src/logging/logger');

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');

  return {
    SafeAreaProvider: ({ children }: { children: ReactNode }) => (
      <View>{children}</View>
    ),
    initialWindowMetrics: {
      frame: { height: 800, width: 400, x: 0, y: 0 },
      insets: { bottom: 0, left: 0, right: 0, top: 0 },
    },
  };
});

describe('AppProviders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
  });

  it('logs app background and foreground transitions', () => {
    let handleAppStateChange:
      | ((state: 'active' | 'background' | 'inactive') => void)
      | null = null;
    const remove = jest.fn();

    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((eventType, listener) => {
        if (eventType === 'change') {
          handleAppStateChange = listener as typeof handleAppStateChange;
        }

        return { remove };
      });

    const { getByTestId, unmount } = render(
      <AppProviders>
        <Text>Child</Text>
      </AppProviders>,
    );

    expect(getByTestId('keyboard-provider')).toBeTruthy();
    expect(normalizeAppLogLevel).toHaveBeenCalledWith('debug', {
      fallbackLogLevel: 'debug',
    });
    expect(setAppLogLevel).toHaveBeenCalledWith('debug');
    expect(handleAppStateChange).toBeTruthy();

    act(() => {
      handleAppStateChange?.('background');
      handleAppStateChange?.('active');
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'App moved to background',
      expect.objectContaining({
        from: 'active',
        to: 'background',
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'App moved to foreground',
      expect.objectContaining({
        from: 'background',
        to: 'active',
      }),
    );

    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
