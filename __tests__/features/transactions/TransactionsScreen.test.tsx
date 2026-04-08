import { fireEvent, render, screen } from '@testing-library/react-native';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import { TransactionsScreen } from '../../../src/features/transactions/TransactionsScreen';
import {
  createInitialSharedDocument,
  createSharedStore,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockBack = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const mockReactNative = jest.requireActual('react-native');
  const { Text } = mockReactNative;

  function MockIcon() {
    return <Text>icon</Text>;
  }

  return {
    Feather: MockIcon,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

beforeAll(() => {
  global.requestAnimationFrame ??= (callback: FrameRequestCallback) =>
    setTimeout(callback, 0) as unknown as number;
});

describe('TransactionsScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
  });

  it('groups adjacent point actions for the same child into one tile', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'tx-grouped' }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);

    render(
      <SharedStoreProvider
        initialDocument={store.getState().document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByTestId('transaction-summary-0').props.children).toBe(
      'Ava +2 Points [0 > 2]',
    );
    expect(screen.getByText('2 Actions')).toBeTruthy();
    expect(screen.queryByText('Ava +1 Points [1 > 2]')).toBeNull();
    expect(screen.queryByText('Restore To This Point')).toBeNull();

    fireEvent.press(screen.getByLabelText('Expand Ava +2 Points [0 > 2]'));
    expect(screen.getByText('Ava +1 Points [1 > 2]')).toBeTruthy();
    expect(screen.getByText('Ava +1 Points [0 > 1]')).toBeTruthy();
    expect(screen.queryByText('Restore To This Point')).toBeNull();

    fireEvent.press(screen.getByLabelText('Expand Ava +1 Points [0 > 1]'));
    expect(screen.getByText('Restore To This Point')).toBeTruthy();
  });

  it('shows newest transactions first and hides orphaned rows until enabled', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'tx-screen' }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().setPoints(childId, 4).ok).toBe(true);
    const targetRow = store
      .getState()
      .document.transactions.find(
        (transaction) => transaction.pointsAfter === 1,
      );

    expect(store.getState().restoreTransaction(targetRow?.id ?? '').ok).toBe(
      true,
    );
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);

    render(
      <SharedStoreProvider
        initialDocument={store.getState().document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByTestId('transaction-summary-0').props.children).toBe(
      'Ava +1 Points [1 > 2]',
    );
    expect(screen.queryByText('Ava Set Points [1 > 4]')).toBeNull();

    fireEvent.press(screen.getByText('Orphaned'));
    expect(screen.getByText('Ava Point Changes [0 > 4]')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Expand Ava Point Changes [0 > 4]'));
    expect(screen.getByText('Ava Set Points [1 > 4]')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Expand Ava Set Points [1 > 4]'));
    expect(
      screen.getByText(
        'This transaction lives on a diverged history branch. A newer action sealed that branch, so it can no longer be restored.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Go Back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('can jump from a restore transaction to the original restored transaction', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'tx-jump' }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().setPoints(childId, 4).ok).toBe(true);
    const targetRow = store
      .getState()
      .document.transactions.find(
        (transaction) => transaction.pointsAfter === 1,
      );

    expect(store.getState().restoreTransaction(targetRow?.id ?? '').ok).toBe(
      true,
    );

    render(
      <SharedStoreProvider
        initialDocument={store.getState().document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    fireEvent.press(
      screen.getByLabelText('Expand Restored App to Ava +1 Points [0 > 1]'),
    );
    expect(
      screen.queryByLabelText('Collapse Ava +1 Points [0 > 1]'),
    ).toBeNull();

    fireEvent.press(screen.getByText('Jump To Original'));

    expect(
      screen.getByLabelText('Collapse Ava +1 Points [0 > 1]'),
    ).toBeTruthy();
    expect(screen.getByText('Ava +1 Points [0 > 1]')).toBeTruthy();
  });

  it('shows the new restore head after restoring to a deleted transaction', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'tx-delete' }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Test').ok).toBe(true);
    const deletedChildId = store.getState().document.head.activeChildIds[0];
    expect(store.getState().archiveChild(deletedChildId).ok).toBe(true);
    expect(store.getState().deleteChildPermanently(deletedChildId).ok).toBe(
      true,
    );
    expect(store.getState().addChild('Timmy').ok).toBe(true);

    render(
      <SharedStoreProvider
        initialDocument={store.getState().document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    fireEvent.press(screen.getByLabelText('Expand Test Deleted'));
    fireEvent.press(screen.getByText('Restore To This Point'));

    expect(screen.getByTestId('transaction-summary-0').props.children).toBe(
      'Restored App to Test Deleted',
    );
  });

  it('shows parent session audit entries without restore actions', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'tx-parent-audit',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().recordParentUnlockAttempt(false).ok).toBe(true);
    expect(store.getState().recordParentUnlockAttempt(true).ok).toBe(true);
    expect(store.getState().recordParentModeLocked().ok).toBe(true);

    render(
      <SharedStoreProvider
        initialDocument={store.getState().document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByTestId('transaction-summary-0').props.children).toBe(
      'Parent Mode Locked',
    );
    expect(screen.getByTestId('transaction-summary-1').props.children).toBe(
      'Parent PIN Unlock Succeeded',
    );
    expect(screen.getByTestId('transaction-summary-2').props.children).toBe(
      'Parent PIN Unlock Failed',
    );

    fireEvent.press(screen.getByLabelText('Expand Parent Mode Locked'));
    expect(screen.getByText('Audit entries cannot be restored.')).toBeTruthy();
    expect(screen.queryByText('Restore To This Point')).toBeNull();
  });
});
