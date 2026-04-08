import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LoggedPressable } from '../../src/components/LoggedPressable';

jest.mock('../../src/logging/logger', () => {
  const mockLogger = {
    debug: jest.fn(),
  };

  return {
    __mockLogger: mockLogger,
    createModuleLogger: jest.fn(() => mockLogger),
  };
});

const { __mockLogger: mockLogger } = jest.requireMock(
  '../../src/logging/logger',
);

describe('LoggedPressable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
