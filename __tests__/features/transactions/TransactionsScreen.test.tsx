import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { getThemeTokens } from '../../../src/features/theme/theme';
import { TransactionsScreen } from '../../../src/features/transactions/TransactionsScreen';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockUseAppStorage = jest.fn();
const mockUseAppTheme = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
  }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  const createIcon = (displayName: string) => {
    const Icon = ({ name, ...props }: { name: string }) =>
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
    Ionicons: createIcon('IoniconsIcon'),
  };
});

jest.mock('../../../src/components/ScreenHeader', () => ({
  ScreenHeader: ({
    actions,
    leadingControl,
    subtitle,
    title,
  }: {
    actions?: React.ReactNode;
    leadingControl?: React.ReactNode;
    subtitle?: string;
    title: string;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text, View } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return React.createElement(
      View,
      null,
      leadingControl,
      React.createElement(Text, null, title),
      subtitle ? React.createElement(Text, null, subtitle) : null,
      actions,
    );
  },
}));

jest.mock('../../../src/features/app/appStorage', () => ({
  useAppStorage: () => mockUseAppStorage(),
}));

jest.mock('../../../src/features/theme/themeContext', () => ({
  useAppTheme: () => mockUseAppTheme(),
  useThemedStyles: (factory: (theme: unknown) => unknown) =>
    factory(mockUseAppTheme()),
}));

describe('TransactionsScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockReplace.mockReset();
    mockUseAppStorage.mockReset();
    mockUseAppTheme.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    mockUseAppTheme.mockReturnValue({
      getScreenSurface: jest.fn(() => '#ffffff'),
      resolvedTheme: 'light',
      setThemeMode: jest.fn(),
      statusBarStyle: 'dark',
      themeMode: 'system',
      tokens: getThemeTokens('light'),
    });
  });

  it('redirects back home when parent mode is locked', () => {
    mockUseAppStorage.mockReturnValue(
      createStorageState({
        isHydrated: true,
        parentSession: {
          isUnlocked: false,
        },
      }),
    );

    render(<TransactionsScreen />);

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('shows restore points, restore events, and focused rollback paths', () => {
    const restoreTransaction = jest.fn();
    const clearTransactionHistory = jest.fn();

    mockUseAppStorage.mockReturnValue(
      createStorageState({
        clearTransactionHistory,
        getRestorePreview: (actionEventId: string) =>
          actionEventId === 'evt-3'
            ? {
                affectedActionEventIds: ['evt-4'],
                isReachable: true,
                mode: 'backward',
                target: null,
              }
            : {
                affectedActionEventIds: [],
                isReachable: false,
                mode: null,
                target: null,
              },
        restoreTransaction,
        transactions: [
          createActionTransaction({
            forward: {
              child: {
                archivedAt: null,
                avatarColor: '#abcdef',
                displayName: 'Ava',
                id: 'child-1',
                isArchived: false,
                points: 0,
                sortOrder: 0,
              },
              type: 'child-added',
            },
            id: 1,
            isReachableRestorePoint: true,
            latestEventId: 'evt-1',
            restoreDirection: 'backward',
            rowId: 'action:thr-1',
            threadId: 'thr-1',
          }),
          createActionTransaction({
            forward: {
              nextTimerState: {
                cycleStartedAt: 1_000,
                isRunning: true,
                pausedRemainingMs: null,
              },
              startedAt: 1_000,
              type: 'timer-started',
            },
            id: 2,
            isReachableRestorePoint: false,
            kind: 'timer-started',
            latestEventId: 'evt-2',
            rowId: 'action:thr-2',
            threadId: 'thr-2',
          }),
          createActionTransaction({
            forward: {
              childId: 'child-1',
              childName: 'Ava',
              delta: 5,
              nextPoints: 5,
              previousPoints: 0,
              source: 'tap',
              type: 'child-points-adjusted',
            },
            id: 3,
            isReachableRestorePoint: true,
            latestEventId: 'evt-3',
            restoreDirection: 'backward',
            rowId: 'action:thr-3',
            threadId: 'thr-3',
          }),
          createActionTransaction({
            forward: {
              childId: 'child-1',
              nextName: 'Rowan',
              previousName: 'Ava',
              type: 'child-renamed',
            },
            id: 4,
            isCurrent: true,
            isReachableRestorePoint: false,
            kind: 'child-renamed',
            latestEventId: 'evt-4',
            rowId: 'action:thr-4',
            threadId: 'thr-4',
          }),
          createRestoreTransaction({
            id: 5,
            rowId: 'restore:evt-5',
            targetActionEventId: 'evt-1',
            targetSummary: 'Added Ava',
          }),
        ],
      }),
    );

    const view = render(<TransactionsScreen />);

    fireEvent.press(view.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();

    fireEvent.press(view.getByLabelText('Clear transaction history'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Clear transaction history',
      expect.stringContaining('only be used during development'),
      expect.any(Array),
    );

    const clearDialog = (Alert.alert as jest.Mock).mock.calls[0] as [
      string,
      string,
      { onPress?: () => void }[],
    ];
    clearDialog[2]?.[1]?.onPress?.();

    expect(clearTransactionHistory).toHaveBeenCalled();
    expect(view.getByText('Restored to Added Ava')).toBeTruthy();
    expect(view.queryByLabelText('Restore transaction 5')).toBeNull();

    fireEvent.press(view.getByLabelText('Select transaction 3'));

    expect(view.getByText('Restore here')).toBeTruthy();
    expect(
      view.getByText('Highlighted actions above will be rolled back.'),
    ).toBeTruthy();
    expect(view.getByText('Started timer')).toBeTruthy();

    fireEvent.press(view.getByLabelText('Focus affected actions'));

    expect(
      view.getByText('Showing only the affected actions for this chain.'),
    ).toBeTruthy();
    expect(view.queryByText('Started timer')).toBeNull();
    expect(view.getByText('Ava renamed to Rowan')).toBeTruthy();

    fireEvent.press(view.getByLabelText('Show all actions'));

    expect(view.getByText('Started timer')).toBeTruthy();

    fireEvent.press(view.getByLabelText('Restore transaction 3'));

    expect(restoreTransaction).toHaveBeenCalledWith('evt-3');
  });

  it('shows forward restore copy for reapplying actions', () => {
    mockUseAppStorage.mockReturnValue(
      createStorageState({
        getRestorePreview: (actionEventId: string) =>
          actionEventId === 'evt-2'
            ? {
                affectedActionEventIds: ['evt-2'],
                isReachable: true,
                mode: 'forward',
                target: null,
              }
            : {
                affectedActionEventIds: [],
                isReachable: false,
                mode: null,
                target: null,
              },
        transactions: [
          createActionTransaction({
            id: 1,
            isCurrent: true,
            isReachableRestorePoint: false,
            latestEventId: 'evt-1',
            rowId: 'action:thr-1',
            threadId: 'thr-1',
          }),
          createActionTransaction({
            id: 2,
            isReachableRestorePoint: true,
            latestEventId: 'evt-2',
            restoreDirection: 'forward',
            rowId: 'action:thr-2',
            threadId: 'thr-2',
          }),
        ],
      }),
    );

    const view = render(<TransactionsScreen />);

    fireEvent.press(view.getByLabelText('Select transaction 2'));

    expect(
      view.getByText('Highlighted actions below will be reapplied.'),
    ).toBeTruthy();
  });
});

function createStorageState(
  overrides: Partial<{
    clearTransactionHistory: () => void;
    getRestorePreview: (actionEventId: string) => {
      affectedActionEventIds: string[];
      isReachable: boolean;
      mode: 'backward' | 'forward' | null;
      target: null;
    };
    isHydrated: boolean;
    parentSession: {
      isUnlocked: boolean;
    };
    restoreTransaction: (actionEventId: string) => void;
    transactions: (
      | ReturnType<typeof createActionTransaction>
      | ReturnType<typeof createRestoreTransaction>
    )[];
  }> = {},
) {
  return {
    clearTransactionHistory: jest.fn(),
    getRestorePreview: jest.fn(() => ({
      affectedActionEventIds: [],
      isReachable: false,
      mode: null,
      target: null,
    })),
    isHydrated: true,
    parentSession: {
      isUnlocked: true,
    },
    restoreTransaction: jest.fn(),
    transactions: [],
    ...overrides,
  };
}

function createActionTransaction(
  overrides: Partial<{
    actorDeviceName: string;
    forward: object;
    id: number;
    isCurrent: boolean;
    isReachableRestorePoint: boolean;
    kind: string;
    latestEventId: string;
    occurredAt: number;
    restoreDirection: 'backward' | 'forward' | null;
    rowId: string;
    threadId: string;
  }> = {},
) {
  return {
    actorDeviceName: 'Parent Phone',
    forward: {
      type: 'child-added',
      child: {
        archivedAt: null,
        avatarColor: '#abcdef',
        displayName: 'Ava',
        id: 'child-1',
        isArchived: false,
        points: 0,
        sortOrder: 0,
      },
    },
    id: 1,
    isCurrent: false,
    isReachableRestorePoint: true,
    kind: 'child-added',
    latestEventId: 'evt-1',
    occurredAt: 1_000,
    restoreDirection: 'backward' as const,
    rowId: 'action:thr-1',
    rowKind: 'action' as const,
    threadId: 'thr-1',
    ...overrides,
  };
}

function createRestoreTransaction(
  overrides: Partial<{
    actorDeviceName: string;
    eventId: string;
    id: number;
    occurredAt: number;
    rowId: string;
    targetActionEventId: string;
    targetSummary: string;
  }> = {},
) {
  return {
    actorDeviceName: 'Parent Phone',
    eventId: 'evt-restore-1',
    id: 1,
    kind: 'restore-event' as const,
    occurredAt: 1_000,
    rowId: 'restore:evt-restore-1',
    rowKind: 'restore' as const,
    targetActionEventId: 'evt-1',
    targetSummary: 'Added Ava',
    ...overrides,
  };
}
