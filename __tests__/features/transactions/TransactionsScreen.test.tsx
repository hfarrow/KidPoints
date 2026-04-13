import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import { TransactionsScreen } from '../../../src/features/transactions/TransactionsScreen';
import {
  createInitialSharedDocument,
  createSharedStore,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const mockReactNative = jest.requireActual('react-native');
  const { Text } = mockReactNative;

  function MockIcon() {
    return <Text>icon</Text>;
  }

  return {
    Feather: MockIcon,
    Ionicons: MockIcon,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    navigate: mockNavigate,
  }),
}));

beforeAll(() => {
  global.requestAnimationFrame ??= (callback: FrameRequestCallback) =>
    setTimeout(callback, 0) as unknown as number;
});

describe('TransactionsScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockNavigate.mockReset();
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
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppSettingsProvider>
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

    const groupedTileStyle = StyleSheet.flatten(
      screen.getByTestId(/transaction-origin-group-/).props.style,
    );
    const nestedRowStyle = StyleSheet.flatten(
      screen.getByTestId(
        `transaction-origin-${store.getState().document.transactions[1].id}`,
      ).props.style,
    );

    expect(groupedTileStyle.backgroundColor).toBe('#e5d8fb');
    expect(nestedRowStyle.backgroundColor).toBe('#cbc5ef');
    expect(groupedTileStyle.backgroundColor).not.toBe(
      nestedRowStyle.backgroundColor,
    );

    fireEvent.press(screen.getByLabelText('Expand Ava +1 Points [0 > 1]'));
    expect(screen.getByText('Restore To This Point')).toBeTruthy();
  });

  it('shows the shared sync shortcut in the screen header', () => {
    render(
      <SharedStoreProvider storage={createMemoryStorage()}>
        <ParentSessionProvider initialParentUnlocked>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByLabelText('Open Device Sync')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Open Device Sync'));

    expect(mockNavigate).toHaveBeenCalledWith('/sync');
  });

  it('groups mixed check-in results into one expandable tile while keeping dismissal rows audit-only', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'tx-check-in-group',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    expect(store.getState().addChild('Noah').ok).toBe(true);
    const [avaId, noahId] = store.getState().document.head.activeChildIds;

    if (!avaId || !noahId) {
      throw new Error('Expected grouped check-in test to create two children');
    }

    expect(
      store.getState().resolveCheckInSession([
        { childId: avaId, status: 'dismissed' },
        { childId: noahId, status: 'awarded' },
      ]).ok,
    ).toBe(true);

    render(
      <SharedStoreProvider
        initialDocument={store.getState().document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByTestId('transaction-summary-0').props.children).toBe(
      'Check-In Results +1 Point',
    );
    expect(screen.getByText('2 Actions')).toBeTruthy();
    expect(screen.queryByText('Ava Check-In Dismissed')).toBeNull();
    expect(screen.queryByText('Ava +1 Points [0 > 1]')).toBeNull();
    expect(screen.queryByText('Restore To This Point')).toBeNull();

    fireEvent.press(screen.getByLabelText('Expand Check-In Results +1 Point'));
    expect(screen.getByText('Ava Check-In Dismissed')).toBeTruthy();
    expect(screen.getByText('Noah +1 Points [0 > 1]')).toBeTruthy();
    expect(screen.queryByText('Audit entries cannot be restored.')).toBeNull();

    fireEvent.press(screen.getByLabelText('Expand Ava Check-In Dismissed'));
    expect(screen.getByText('Audit entries cannot be restored.')).toBeTruthy();
    expect(screen.queryByText('Restore To This Point')).toBeNull();

    fireEvent.press(screen.getByLabelText('Expand Noah +1 Points [0 > 1]'));
    expect(screen.getAllByText('HEAD')).toHaveLength(2);
    expect(screen.queryByText('Restore To This Point')).toBeNull();
  });

  it('shows a parent tile for a single-row check-in session', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'tx-check-in-single',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];

    if (!childId) {
      throw new Error('Expected single check-in test to create one child');
    }

    expect(
      store.getState().resolveCheckInSession([{ childId, status: 'awarded' }])
        .ok,
    ).toBe(true);

    render(
      <SharedStoreProvider
        initialDocument={store.getState().document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByTestId('transaction-summary-0').props.children).toBe(
      'Check-In Awards +1 Point',
    );
    expect(screen.getByText('1 Actions')).toBeTruthy();
    expect(screen.queryByText('Ava +1 Points [0 > 1]')).toBeNull();

    fireEvent.press(screen.getByLabelText('Expand Check-In Awards +1 Point'));
    expect(screen.getByText('Ava +1 Points [0 > 1]')).toBeTruthy();
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
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppSettingsProvider>
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
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppSettingsProvider>
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
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppSettingsProvider>
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
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppSettingsProvider>
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

  it('shows timer lifecycle entries as audit-only rows without restore actions', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'tx-timer-audit',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().startTimer().ok).toBe(true);

    render(
      <SharedStoreProvider
        initialDocument={store.getState().document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.getByTestId('transaction-summary-0').props.children).toBe(
      'Started Timer',
    );

    fireEvent.press(screen.getByLabelText('Expand Started Timer'));
    expect(screen.getByText('Audit entries cannot be restored.')).toBeTruthy();
    expect(screen.queryByText('Restore To This Point')).toBeNull();
  });

  it('keeps local and synced point history in separate tiles and tints them by origin', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'tx-origin-split',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];

    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);

    const localDocument = store.getState().document;
    const remoteAdjustedDocument = {
      ...localDocument,
      transactions: localDocument.transactions.map((transaction) =>
        transaction.pointsAfter === 1
          ? {
              ...transaction,
              originDeviceId: 'remote-device',
            }
          : transaction,
      ),
    };
    const latestLocalTransaction = remoteAdjustedDocument.transactions.find(
      (transaction) => transaction.pointsAfter === 2,
    );
    const remoteTransaction = remoteAdjustedDocument.transactions.find(
      (transaction) => transaction.pointsAfter === 1,
    );

    if (!latestLocalTransaction || !remoteTransaction) {
      throw new Error('Expected split-origin point transactions to exist');
    }

    render(
      <SharedStoreProvider
        initialDocument={remoteAdjustedDocument}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppSettingsProvider
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <TransactionsScreen />
          </AppSettingsProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    expect(screen.queryByText('Ava +2 Points [0 > 2]')).toBeNull();
    expect(screen.getByText('Ava +1 Points [1 > 2]')).toBeTruthy();
    expect(screen.getByText('Ava +1 Points [0 > 1]')).toBeTruthy();

    const localTileStyle = StyleSheet.flatten(
      screen.getByTestId(`transaction-origin-${latestLocalTransaction.id}`)
        .props.style,
    );
    const remoteTileStyle = StyleSheet.flatten(
      screen.getByTestId(`transaction-origin-${remoteTransaction.id}`).props
        .style,
    );

    expect(localTileStyle.backgroundColor).toBe('#e5d8fb');
    expect(remoteTileStyle.backgroundColor).toBe('#c3b7d8');
  });
});
