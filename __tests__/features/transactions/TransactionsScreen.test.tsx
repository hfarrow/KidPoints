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

  it('shows action threads, hides raw control events, and restores reverted actions', () => {
    const revertTransaction = jest.fn();
    const restoreTransaction = jest.fn();
    const clearTransactionHistory = jest.fn();

    mockUseAppStorage.mockReturnValue(
      createStorageState({
        clearTransactionHistory,
        getRestorePlan: (threadId: string) =>
          threadId === 'thread-1' ? ['thread-3', 'thread-1'] : [],
        restoreTransaction,
        revertTransaction,
        transactions: [
          createTransaction({
            activity: [
              {
                actorDeviceName: 'Parent Phone',
                eventId: 'evt-revert',
                kind: 'revert',
                occurredAt: 1_000,
              },
            ],
            entityRefs: ['child:child-1', 'child-lifecycle:child-1'],
            forward: {
              childId: 'child-1',
              childName: 'Ava',
              delta: 5,
              nextPoints: 5,
              previousPoints: 0,
              source: 'tap',
              type: 'child-points-adjusted',
            },
            id: 1,
            latestControlTargetThreadIds: ['thread-3', 'thread-1'],
            status: 'reverted',
            threadId: 'thread-1',
            undoPolicy: 'reversible',
          }),
          createTransaction({
            entityRefs: ['timer:shared'],
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
            threadId: 'thread-2',
            undoPolicy: 'tracked_only',
          }),
          createTransaction({
            entityRefs: ['child:child-1'],
            explicitStatus: 'applied',
            forward: {
              childId: 'child-1',
              nextName: 'Rowan',
              previousName: 'Ava',
              type: 'child-renamed',
            },
            id: 3,
            status: 'reverted',
            threadId: 'thread-3',
            undoPolicy: 'tracked_only',
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
    expect(view.getByText('Ava +5 points (0')).toBeTruthy();
    expect(view.getByLabelText('chevron-forward')).toBeTruthy();
    expect(view.getByText('5)')).toBeTruthy();
    expect(view.getByText('Ava renamed to Rowan')).toBeTruthy();
    expect(view.queryByText(/Reverted:/)).toBeNull();
    expect(view.queryByLabelText('Restore transaction 1')).toBeNull();

    fireEvent.press(view.getByLabelText('Select transaction 1'));

    expect(view.getByText('Restore 2 actions')).toBeTruthy();
    expect(view.getByText(/Reverted \| Parent Phone \|/)).toBeTruthy();

    fireEvent.press(view.getByLabelText('Restore transaction 1'));

    expect(restoreTransaction).toHaveBeenCalledWith('thread-1');
    expect(revertTransaction).not.toHaveBeenCalled();
  });
});

function createStorageState(
  overrides: Partial<{
    clearTransactionHistory: () => void;
    getRevertPlan: (threadId: string) => string[];
    getRestorePlan: (threadId: string) => string[];
    isHydrated: boolean;
    parentSession: {
      isUnlocked: boolean;
    };
    restoreTransaction: (threadId: string) => void;
    revertTransaction: (threadId: string) => void;
    transactions: ReturnType<typeof createTransaction>[];
  }> = {},
) {
  return {
    clearTransactionHistory: jest.fn(),
    getRevertPlan: jest.fn(() => []),
    getRestorePlan: jest.fn(() => []),
    isHydrated: true,
    parentSession: {
      isUnlocked: true,
    },
    restoreTransaction: jest.fn(),
    revertTransaction: jest.fn(),
    transactions: [],
    ...overrides,
  };
}

function createTransaction(
  overrides: Partial<{
    activity: {
      actorDeviceName: string;
      eventId: string;
      kind: 'restore' | 'revert';
      occurredAt: number;
    }[];
    actorDeviceName: string;
    dependsOnThreadIds: string[];
    entityRefs: string[];
    explicitStatus: 'applied' | 'reverted';
    forward: object;
    id: number;
    kind: string;
    latestControlTargetThreadIds: string[];
    occurredAt: number;
    rootEventId: string;
    status: 'applied' | 'reverted';
    threadId: string;
    undoPolicy: 'reversible' | 'tracked_only';
  }>,
) {
  return {
    activity: [],
    actorDeviceName: 'Parent Phone',
    dependsOnThreadIds: [],
    entityRefs: [],
    explicitStatus: 'reverted' as const,
    forward: {
      type: 'timer-reset',
    },
    id: 1,
    kind: 'timer-reset',
    latestControlTargetThreadIds: ['thread-1'],
    occurredAt: 1_000,
    rootEventId: 'evt-root',
    status: 'applied' as const,
    threadId: 'thread-1',
    undoPolicy: 'tracked_only' as const,
    ...overrides,
  };
}
