import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import { HomeScreen } from '../src/features/home/HomeScreen';
import { getThemeTokens } from '../src/features/theme/theme';

const mockPush = jest.fn();
const mockUseAppStorage = jest.fn();
const mockUseAppTheme = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('../src/features/app/appStorage', () => ({
  useAppStorage: () => mockUseAppStorage(),
}));

jest.mock('../src/features/theme/themeContext', () => ({
  useAppTheme: () => mockUseAppTheme(),
  useThemedStyles: (factory: (theme: unknown) => unknown) =>
    factory(mockUseAppTheme()),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUseAppStorage.mockReset();
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

  it('hides the child tile expander and point caps when parent mode is locked', () => {
    mockUseAppStorage.mockReturnValue(createStorageState(false));

    const view = render(<HomeScreen />);

    expect(view.getByText('Ava')).toBeTruthy();
    expect(view.getByText('7')).toBeTruthy();
    expect(view.queryByText('Start')).toBeNull();
    expect(view.queryByText('Pause')).toBeNull();
    expect(view.queryByText('Reset')).toBeNull();
    expect(view.queryByText('-')).toBeNull();
    expect(view.queryByText('+')).toBeNull();
    expect(view.queryByLabelText('Open Ava settings')).toBeNull();
    expect(view.queryByText('v')).toBeNull();
    expect(view.queryByText('>')).toBeNull();
  });

  it('prompts for the parent pin before enabling parent mode from the alarm time in child mode', () => {
    const unlockParent = jest.fn((pin: string) => pin === '0000');
    mockUseAppStorage.mockReturnValue(
      createStorageState(false, {
        unlockParent,
      }),
    );

    const view = render(<HomeScreen />);

    fireEvent.press(view.getByLabelText('Open alarm settings'));

    expect(view.getByText('Parent Mode')).toBeTruthy();

    fireEvent.changeText(view.getByLabelText('Parent PIN'), '0000');

    expect(unlockParent).toHaveBeenCalledWith('0000');
    expect(mockPush).not.toHaveBeenCalled();
    expect(view.queryByText('Parent Mode')).toBeNull();
  });

  it('prompts for the parent pin before enabling point editing in child mode', () => {
    const unlockParent = jest.fn((pin: string) => pin === '0000');
    mockUseAppStorage.mockReturnValue(
      createStorageState(false, {
        unlockParent,
      }),
    );

    const view = render(<HomeScreen />);

    fireEvent.press(view.getByLabelText('Edit Ava points'));

    expect(view.getByText('Parent Mode')).toBeTruthy();

    fireEvent.changeText(view.getByLabelText('Parent PIN'), '0000');

    expect(unlockParent).toHaveBeenCalledWith('0000');
    expect(view.queryByText('Save points')).toBeNull();
  });

  it('autosaves a renamed child when the settings input loses focus', () => {
    const renameChild = jest.fn();
    mockUseAppStorage.mockReturnValue(
      createStorageState(true, {
        renameChild,
      }),
    );

    const view = render(<HomeScreen />);

    fireEvent.press(view.getByLabelText('Open Ava settings'));

    expect(view.getByText('Ava settings')).toBeTruthy();

    fireEvent.changeText(view.getByLabelText('Child name for Ava'), 'Rowan');
    fireEvent(view.getByLabelText('Child name for Ava'), 'blur');

    expect(renameChild).toHaveBeenCalledWith('child-1', 'Rowan');
    expect(view.getByText('Ava settings')).toBeTruthy();
  });

  it('closes the child settings tile from the Save action', () => {
    const renameChild = jest.fn();
    mockUseAppStorage.mockReturnValue(
      createStorageState(true, {
        renameChild,
      }),
    );

    const view = render(<HomeScreen />);

    fireEvent.press(view.getByLabelText('Open Ava settings'));
    fireEvent.changeText(view.getByLabelText('Child name for Ava'), 'Rowan');
    fireEvent.press(view.getByText('Save'));

    expect(renameChild).toHaveBeenCalledWith('child-1', 'Rowan');
    expect(view.queryByText('Ava settings')).toBeNull();
  });

  it('shows a settings gear instead of an expander on child tiles when parent mode is unlocked', () => {
    mockUseAppStorage.mockReturnValue(createStorageState(true));

    const view = render(<HomeScreen />);

    expect(view.getByText('Start')).toBeTruthy();
    expect(view.getByText('Reset')).toBeTruthy();
    expect(view.getByText('-')).toBeTruthy();
    expect(view.getByText('+')).toBeTruthy();
    expect(view.getByLabelText('Open Ava settings')).toBeTruthy();
    expect(view.queryByText('v')).toBeNull();
    expect(view.queryByText('Move up')).toBeNull();
    expect(view.queryByText('Move down')).toBeNull();
  });
});

function createStorageState(
  isUnlocked: boolean,
  overrides: Partial<ReturnType<typeof buildStorageState>> = {},
) {
  return {
    ...buildStorageState(isUnlocked),
    ...overrides,
  };
}

function buildStorageState(isUnlocked: boolean) {
  return {
    addChild: jest.fn(),
    children: [
      {
        avatarColor: '#93c5fd',
        displayName: 'Ava',
        id: 'child-1',
        isActive: true,
        points: 7,
        sortOrder: 0,
      },
    ],
    decrementPoints: jest.fn(),
    incrementPoints: jest.fn(),
    isHydrated: true,
    lockParent: jest.fn(),
    moveChild: jest.fn(),
    parentSession: {
      isUnlocked,
    },
    pauseTimer: jest.fn(),
    renameChild: jest.fn(),
    removeChild: jest.fn(),
    resetTimer: jest.fn(),
    setPoints: jest.fn(),
    startTimer: jest.fn(),
    timerSnapshot: {
      currentCycleStartedAt: null,
      isRunning: false,
      nextTriggerAt: null,
      remainingMs: 900_000,
    },
    unlockParent: jest.fn((_: string) => true),
  };
}
