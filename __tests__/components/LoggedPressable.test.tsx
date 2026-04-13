import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  LoggedPressable,
  resetLoggedPressableDebounceForTests,
} from '../../src/components/LoggedPressable';

jest.mock('../../src/logging/logger', () => {
  const mockLogger = {
    debug: jest.fn(),
    temp: jest.fn(),
  };

  return {
    __mockLogger: mockLogger,
    createModuleLogger: jest.fn(() => mockLogger),
    createStructuredLog: jest.fn((loggerInstance, level, message) => {
      return (details = {}) => {
        loggerInstance[level](message, details);
      };
    }),
  };
});

const { __mockLogger: mockLogger } = jest.requireMock(
  '../../src/logging/logger',
);

describe('LoggedPressable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLoggedPressableDebounceForTests();
  });

  it('logs the press and still calls through to onPress', () => {
    const onPress = jest.fn();

    render(
      <LoggedPressable
        accessibilityLabel="Open Settings"
        logContext={{ area: 'header' }}
        logLabel="Open Settings"
        onPress={onPress}
      >
        <Text>Open</Text>
      </LoggedPressable>,
    );

    fireEvent.press(screen.getByLabelText('Open Settings'));

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Pressable pressed',
      expect.objectContaining({
        accessibilityLabel: 'Open Settings',
        area: 'header',
        label: 'Open Settings',
      }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('can skip press logging when disabled', () => {
    const onPress = jest.fn();

    render(
      <LoggedPressable
        accessibilityLabel="Open Logs"
        disableLogging
        logLabel="Open Logs"
        onPress={onPress}
      >
        <Text>Open Logs</Text>
      </LoggedPressable>,
    );

    fireEvent.press(screen.getByLabelText('Open Logs'));

    expect(mockLogger.debug).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('debounces rapid repeat presses by default', () => {
    const onPress = jest.fn();
    const dateNowSpy = jest.spyOn(Date, 'now');

    dateNowSpy
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_100)
      .mockReturnValueOnce(1_700);

    render(
      <LoggedPressable
        accessibilityLabel="Open Logs"
        logLabel="Open Logs"
        onPress={onPress}
        pressDebounceMs={500}
      >
        <Text>Open Logs</Text>
      </LoggedPressable>,
    );

    fireEvent.press(screen.getByLabelText('Open Logs'));
    fireEvent.press(screen.getByLabelText('Open Logs'));
    fireEvent.press(screen.getByLabelText('Open Logs'));

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('can opt out of press debouncing', () => {
    const onPress = jest.fn();
    const dateNowSpy = jest.spyOn(Date, 'now');

    dateNowSpy.mockReturnValue(1_000);

    render(
      <LoggedPressable
        accessibilityLabel="Increase Points"
        disablePressDebounce
        logLabel="Increase Points"
        onPress={onPress}
      >
        <Text>Increase</Text>
      </LoggedPressable>,
    );

    fireEvent.press(screen.getByLabelText('Increase Points'));
    fireEvent.press(screen.getByLabelText('Increase Points'));

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('keeps debouncing active across button remounts for the same action', () => {
    const onPress = jest.fn();
    const dateNowSpy = jest.spyOn(Date, 'now');

    dateNowSpy.mockReturnValue(1_000);

    const firstRender = render(
      <LoggedPressable
        accessibilityLabel="Open Logs"
        logLabel="Open Logs"
        onPress={onPress}
        pressDebounceMs={500}
      >
        <Text>Open Logs</Text>
      </LoggedPressable>,
    );

    fireEvent.press(firstRender.getByLabelText('Open Logs'));
    firstRender.unmount();

    const secondRender = render(
      <LoggedPressable
        accessibilityLabel="Open Logs"
        logLabel="Open Logs"
        onPress={onPress}
        pressDebounceMs={500}
      >
        <Text>Open Logs</Text>
      </LoggedPressable>,
    );

    fireEvent.press(secondRender.getByLabelText('Open Logs'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
