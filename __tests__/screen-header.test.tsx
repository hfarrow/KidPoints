import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import { ScreenHeader } from '../src/components/ScreenHeader';
import { getThemeTokens } from '../src/features/theme/theme';

jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  const Ionicons = ({ name, ...props }: { name: string }) =>
    React.createElement(
      Text,
      { ...props, accessibilityLabel: name },
      'Ionicon',
    );

  Ionicons.displayName = 'Ionicons';

  return {
    Ionicons,
  };
});

const mockLockParent = jest.fn();
const mockUnlockParent = jest.fn();
let currentThemeMode: 'light' | 'dark' | 'system' = 'system';
const mockSetThemeMode = jest.fn((mode: 'light' | 'dark' | 'system') => {
  currentThemeMode = mode;
});

jest.mock('../src/features/app/appStorage', () => ({
  useAppStorage: jest.fn(),
}));

jest.mock('../src/features/theme/themeContext', () => {
  const useAppTheme = jest.fn();

  return {
    useAppTheme,
    useThemedStyles: (factory: (theme: unknown) => unknown) =>
      factory(useAppTheme()),
  };
});

const { useAppStorage } = jest.requireMock(
  '../src/features/app/appStorage',
) as {
  useAppStorage: jest.Mock;
};

const { useAppTheme } = jest.requireMock(
  '../src/features/theme/themeContext',
) as {
  useAppTheme: jest.Mock;
};

describe('ScreenHeader', () => {
  beforeEach(() => {
    currentThemeMode = 'system';
    mockLockParent.mockReset();
    mockUnlockParent.mockReset();
    mockSetThemeMode.mockClear();

    useAppStorage.mockReturnValue({
      lockParent: mockLockParent,
      parentSession: {
        isUnlocked: false,
      },
      unlockParent: mockUnlockParent,
    });

    useAppTheme.mockImplementation(() => ({
      getScreenSurface: jest.fn(),
      resolvedTheme: 'light',
      setThemeMode: mockSetThemeMode,
      statusBarStyle: 'dark',
      themeMode: currentThemeMode,
      tokens: getThemeTokens('light'),
    }));
  });

  it('renders a settings button, opens the modal, and updates the theme selection', () => {
    const view = render(<ScreenHeader title="Home" subtitle="KidPoints" />);

    fireEvent.press(view.getByLabelText('Open settings'));

    expect(view.getByText('Settings')).toBeTruthy();
    expect(
      view.getByLabelText('Use Dark theme').props.accessibilityState,
    ).toEqual({ selected: false });

    fireEvent.press(view.getByLabelText('Use Dark theme'));

    expect(mockSetThemeMode).toHaveBeenCalledWith('dark');

    view.rerender(<ScreenHeader title="Home" subtitle="KidPoints" />);

    expect(
      view.getByLabelText('Use Dark theme').props.accessibilityState,
    ).toEqual({ selected: true });
  });
});
