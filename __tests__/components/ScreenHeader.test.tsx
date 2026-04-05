import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ScreenHeader } from '../../src/components/ScreenHeader';
import { getThemeTokens } from '../../src/features/theme/theme';

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

jest.mock('../../src/features/app/appStorage', () => ({
  useAppStorage: jest.fn(),
}));

jest.mock('../../src/features/theme/themeContext', () => {
  const useAppTheme = jest.fn();

  return {
    useAppTheme,
    useThemedStyles: (factory: (theme: unknown) => unknown) =>
      factory(useAppTheme()),
  };
});

const { useAppStorage } = jest.requireMock(
  '../../src/features/app/appStorage',
) as {
  useAppStorage: jest.Mock;
};

const { useAppTheme } = jest.requireMock(
  '../../src/features/theme/themeContext',
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

  it('uses locked and unlocked icon buttons for parent mode', () => {
    useAppStorage.mockReturnValue({
      lockParent: mockLockParent,
      parentSession: {
        isUnlocked: true,
      },
      unlockParent: mockUnlockParent,
    });

    const view = render(<ScreenHeader title="Home" subtitle="KidPoints" />);

    fireEvent.press(view.getByLabelText('Lock Parent Mode'));

    expect(mockLockParent).toHaveBeenCalled();
    expect(view.getByLabelText('lock-open-outline')).toBeTruthy();
  });

  it('renders screen-specific actions in the controls row', () => {
    const view = render(
      <ScreenHeader
        actions={<Text accessibilityLabel="Extra screen action">Action</Text>}
        subtitle="KidPoints"
        title="Home"
      />,
    );

    expect(view.getByLabelText('Extra screen action')).toBeTruthy();
    expect(view.getByLabelText('Open settings')).toBeTruthy();
    expect(view.getByLabelText('Unlock Parent Mode')).toBeTruthy();
  });

  it('renders a screen-specific leading control next to the title', () => {
    const view = render(
      <ScreenHeader
        leadingControl={
          <Text accessibilityLabel="Back control">Back control</Text>
        }
        subtitle="KidPoints"
        title="Home"
      />,
    );

    expect(view.getByLabelText('Back control')).toBeTruthy();
    expect(view.getByText('Home')).toBeTruthy();
  });
});
