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

  it('shows compact collapsed rows and only reveals actions when a row is expanded', () => {
    const revertTransaction = jest.fn();
    const clearTransactionHistory = jest.fn();
    mockUseAppStorage.mockReturnValue(
      createStorageState({
        clearTransactionHistory,
        getRevertPlan: (transactionId: number) =>
          transactionId === 1 ? [3, 1] : [],
        revertTransaction,
        transactions: [
          createTransaction({
            actorDeviceName: 'Parent Phone',
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
            inverse: {
              childId: 'child-1',
              childName: 'Ava',
              delta: -5,
              nextPoints: 0,
              previousPoints: 5,
              source: 'tap',
              type: 'child-points-adjusted',
            },
            kind: 'child-points-adjusted',
            undoPolicy: 'reversible',
          }),
          createTransaction({
            actorDeviceName: 'Parent Phone',
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
            inverse: null,
            kind: 'timer-started',
            undoPolicy: 'tracked_only',
          }),
          createTransaction({
            actorDeviceName: 'Parent Phone',
            dependsOnTransactionIds: [1, 3],
            entityRefs: ['child:child-1'],
            forward: {
              targetTransactionIds: [1, 3],
              type: 'revert-chain',
            },
            id: 4,
            inverse: {
              targetTransactionIds: [1, 3],
              type: 'reapply-transactions',
            },
            kind: 'revert-chain',
            status: 'applied',
            undoPolicy: 'reversible',
          }),
          createTransaction({
            actorDeviceName: 'Parent Phone',
            dependsOnTransactionIds: [1],
            entityRefs: ['child:child-1'],
            forward: {
              childId: 'child-1',
              nextName: 'Rowan',
              previousName: 'Ava',
              type: 'child-renamed',
            },
            id: 3,
            inverse: null,
            kind: 'child-renamed',
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
    expect(
      view.getByText('Reverted: Ava +5 points (0 → 5) + 1 more'),
    ).toBeTruthy();
    expect(view.queryByLabelText('Revert transaction 2')).toBeNull();
    expect(view.queryByLabelText('Revert transaction 1')).toBeNull();

    fireEvent.press(view.getByLabelText('Select transaction 1'));

    expect(view.getByText('Revert 2 actions')).toBeTruthy();
    expect(view.getByText(/Parent Phone/)).toBeTruthy();

    fireEvent.press(view.getByLabelText('Revert transaction 1'));

    expect(revertTransaction).toHaveBeenCalledWith(1);
  });
});

function createStorageState(
  overrides: Partial<{
    clearTransactionHistory: () => void;
    getRevertPlan: (transactionId: number) => number[];
    isHydrated: boolean;
    parentSession: {
      isUnlocked: boolean;
    };
    revertTransaction: (transactionId: number) => void;
    transactions: ReturnType<typeof createTransaction>[];
  }> = {},
) {
  return {
    clearTransactionHistory: jest.fn(),
    getRevertPlan: jest.fn(() => []),
    isHydrated: true,
    parentSession: {
      isUnlocked: true,
    },
    revertTransaction: jest.fn(),
    transactions: [],
    ...overrides,
  };
}

function createTransaction(
  overrides: Partial<{
    actorDeviceName: string;
    dependsOnTransactionIds: number[];
    entityRefs: string[];
    forward: object;
    id: number;
    inverse: object | null;
    kind: string;
    occurredAt: number;
    revertedByTransactionId: number | null;
    status: 'applied' | 'reverted';
    undoPolicy: 'reversible' | 'tracked_only';
  }>,
) {
  return {
    actorDeviceName: 'Parent Phone',
    dependsOnTransactionIds: [],
    entityRefs: [],
    forward: {
      type: 'timer-reset',
    },
    id: 1,
    inverse: null,
    kind: 'timer-reset',
    occurredAt: 1_000,
    revertedByTransactionId: null,
    status: 'applied' as const,
    undoPolicy: 'tracked_only' as const,
    ...overrides,
  };
}
