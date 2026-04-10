import {
  createInitialSharedDocument,
  createSharedStore,
  deriveTransactionRows,
} from '../../src/state/sharedStore';
import {
  deriveSyncProjection,
  prepareSyncDeviceBundle,
} from '../../src/state/sharedSync';
import { buildSharedTimerViewModel } from '../../src/state/sharedTimer';
import type { SharedDocument } from '../../src/state/sharedTypes';
import { createMemoryStorage } from '../testUtils/memoryStorage';

function cloneDocumentForDevice(document: SharedDocument, deviceId: string) {
  return {
    ...document,
    deviceId,
  } satisfies SharedDocument;
}

describe('sharedStore transaction graph', () => {
  it('records one transaction per critical action and orders rows newest first', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'device-a' }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];

    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().setPoints(childId, 7).ok).toBe(true);

    const document = store.getState().document;
    const rows = deriveTransactionRows(document);

    expect(document.events).toHaveLength(4);
    expect(document.transactions).toHaveLength(4);
    expect(rows[0]?.summaryText).toBe('Ava Set Points [2 > 7]');
    expect(rows[1]?.summaryText).toBe('Ava +1 Points [1 > 2]');
    expect(rows[2]?.summaryText).toBe('Ava +1 Points [0 > 1]');
    expect(rows[3]?.summaryText).toBe('Ava Added');
  });

  it('records grouped per-child check-in transactions when children are awarded or dismissed', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-check-in-batch',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    expect(store.getState().addChild('Noah').ok).toBe(true);
    const [avaId, noahId] = store.getState().document.head.activeChildIds;

    if (!avaId || !noahId) {
      throw new Error('Expected check-in batch test to create two children');
    }

    expect(
      store.getState().resolveCheckInSession([
        { childId: avaId, status: 'dismissed' },
        { childId: noahId, status: 'awarded' },
      ]).ok,
    ).toBe(true);

    const document = store.getState().document;
    const rows = deriveTransactionRows(document);

    expect(document.head.childrenById[avaId]?.points).toBe(0);
    expect(document.head.childrenById[noahId]?.points).toBe(1);
    expect(
      document.events.filter((event) => event.type === 'child.pointsAdjusted'),
    ).toHaveLength(1);
    const pointAdjustmentTransactions = document.transactions.filter(
      (transaction) => transaction.kind === 'points-adjusted',
    );
    const dismissedTransactions = document.transactions.filter(
      (transaction) => transaction.kind === 'check-in-dismissed',
    );

    expect(pointAdjustmentTransactions).toHaveLength(1);
    expect(dismissedTransactions).toHaveLength(1);
    expect(pointAdjustmentTransactions[0]?.groupId).toBeTruthy();
    expect(pointAdjustmentTransactions[0]?.groupId).toBe(
      dismissedTransactions[0]?.groupId,
    );
    expect(pointAdjustmentTransactions[0]?.groupLabel).toBe(
      'Check-In Results +1 Point',
    );
    expect(rows[0]?.summaryText).toBe('Noah +1 Points [0 > 1]');
    expect(rows[1]?.summaryText).toBe('Ava Check-In Dismissed');
  });

  it('records restore as its own transaction and restores the exact target state', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'device-b' }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().setPoints(childId, 4).ok).toBe(true);

    const targetRow = deriveTransactionRows(store.getState().document).find(
      (row) => row.summaryText === 'Ava +1 Points [0 > 1]',
    );

    expect(store.getState().restoreTransaction(targetRow?.id ?? '').ok).toBe(
      true,
    );

    const document = store.getState().document;
    const rows = deriveTransactionRows(document);
    const newestRow = rows[0];
    const originalTargetRow = rows.find(
      (row) => row.summaryText === 'Ava +1 Points [0 > 1]',
    );

    expect(document.head.childrenById[childId]?.points).toBe(1);
    expect(document.transactions.at(-1)?.kind).toBe('history-restored');
    expect(document.isOrphanedRestoreWindowOpen).toBe(true);
    expect(newestRow?.isHead).toBe(true);
    expect(originalTargetRow?.isHead).toBe(true);
    expect(newestRow?.summaryText).toBe(
      'Restored App to Ava +1 Points [0 > 1]',
    );
  });

  it('marks abandoned future transactions orphaned and seals them after a new action', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'device-c' }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().setPoints(childId, 4).ok).toBe(true);

    const targetRow = deriveTransactionRows(store.getState().document).find(
      (row) => row.summaryText === 'Ava +1 Points [0 > 1]',
    );

    expect(store.getState().restoreTransaction(targetRow?.id ?? '').ok).toBe(
      true,
    );

    let rows = deriveTransactionRows(store.getState().document);
    let orphanedSetRow = rows.find(
      (row) => row.summaryText === 'Ava Set Points [1 > 4]',
    );

    expect(orphanedSetRow?.isOrphaned).toBe(true);
    expect(orphanedSetRow?.isRestorableNow).toBe(true);

    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);

    rows = deriveTransactionRows(store.getState().document);
    orphanedSetRow = rows.find(
      (row) => row.summaryText === 'Ava Set Points [1 > 4]',
    );

    expect(store.getState().document.isOrphanedRestoreWindowOpen).toBe(false);
    expect(orphanedSetRow?.isOrphaned).toBe(true);
    expect(orphanedSetRow?.isRestorableNow).toBe(false);
    expect(
      store.getState().restoreTransaction(orphanedSetRow?.id ?? '').ok,
    ).toBe(false);
  });

  it('allows restoring to a deleted-child transaction when it is no longer head', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'device-d' }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Noah').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];

    expect(store.getState().archiveChild(childId).ok).toBe(true);
    expect(store.getState().deleteChildPermanently(childId).ok).toBe(true);
    expect(store.getState().addChild('Ava').ok).toBe(true);

    const deleteRow = deriveTransactionRows(store.getState().document).find(
      (row) => row.kind === 'child-deleted',
    );

    expect(deleteRow?.isRestorableNow).toBe(true);
    expect(store.getState().restoreTransaction(deleteRow?.id ?? '').ok).toBe(
      true,
    );
    expect(
      store.getState().document.head.childrenById[childId],
    ).toBeUndefined();
    expect(store.getState().document.head.activeChildIds).toHaveLength(0);
  });

  it('records failed parent unlock attempts as non-restorable audit transactions', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-parent-audit-failed',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const headBefore = store.getState().document.head;
    const currentHeadTransactionIdBefore =
      store.getState().document.currentHeadTransactionId;

    expect(store.getState().recordParentUnlockAttempt(false).ok).toBe(true);

    const document = store.getState().document;
    const rows = deriveTransactionRows(document);

    expect(document.head).toEqual(headBefore);
    expect(document.currentHeadTransactionId).toBe(
      currentHeadTransactionIdBefore,
    );
    expect(document.transactions.at(-1)).toMatchObject({
      isRestorable: false,
      kind: 'parent-unlock-failed',
      parentTransactionId: currentHeadTransactionIdBefore,
      participatesInHistory: false,
    });
    expect(rows[0]).toMatchObject({
      isHead: false,
      isOrphaned: false,
      isRestorable: false,
      isRestorableNow: false,
      restoreDisabledReason: 'Audit entries cannot be restored.',
      summaryText: 'Parent PIN Unlock Failed',
    });
  });

  it('records successful parent unlock attempts without changing the history head', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-parent-audit-success',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().recordParentUnlockAttempt(true).ok).toBe(true);

    const document = store.getState().document;
    const rows = deriveTransactionRows(document);

    expect(document.currentHeadTransactionId).toBeNull();
    expect(document.transactions.at(-1)).toMatchObject({
      isRestorable: false,
      kind: 'parent-unlock-succeeded',
      parentTransactionId: null,
      participatesInHistory: false,
    });
    expect(rows[0]?.summaryText).toBe('Parent PIN Unlock Succeeded');
    expect(rows[0]?.isHead).toBe(false);
  });

  it('records parent mode locking as a non-restorable audit transaction', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-parent-lock-audit',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const currentHeadTransactionIdBefore =
      store.getState().document.currentHeadTransactionId;

    expect(store.getState().recordParentModeLocked().ok).toBe(true);

    const document = store.getState().document;
    const rows = deriveTransactionRows(document);

    expect(document.currentHeadTransactionId).toBe(
      currentHeadTransactionIdBefore,
    );
    expect(document.transactions.at(-1)).toMatchObject({
      isRestorable: false,
      kind: 'parent-mode-locked',
      parentTransactionId: currentHeadTransactionIdBefore,
      participatesInHistory: false,
    });
    expect(rows[0]).toMatchObject({
      isHead: false,
      isOrphaned: false,
      isRestorable: false,
      isRestorableNow: false,
      restoreDisabledReason: 'Audit entries cannot be restored.',
      summaryText: 'Parent Mode Locked',
    });
  });

  it('keeps the orphaned restore window open after a parent unlock audit entry', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-parent-audit-window',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().setPoints(childId, 4).ok).toBe(true);

    const targetRow = deriveTransactionRows(store.getState().document).find(
      (row) => row.summaryText === 'Ava +1 Points [0 > 1]',
    );

    expect(store.getState().restoreTransaction(targetRow?.id ?? '').ok).toBe(
      true,
    );
    expect(store.getState().recordParentUnlockAttempt(false).ok).toBe(true);

    const document = store.getState().document;
    const rows = deriveTransactionRows(document);
    const orphanedSetRow = rows.find(
      (row) => row.summaryText === 'Ava Set Points [1 > 4]',
    );

    expect(document.isOrphanedRestoreWindowOpen).toBe(true);
    expect(orphanedSetRow?.isOrphaned).toBe(true);
    expect(orphanedSetRow?.isRestorableNow).toBe(true);
    expect(rows[0]?.summaryText).toBe('Parent PIN Unlock Failed');
  });
});

describe('sharedStore timer state', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-07T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts, pauses, resets, and updates shared timer settings', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-timer-a',
      }),
      storage: createMemoryStorage(),
    });

    expect(
      buildSharedTimerViewModel(
        store.getState().document.head.timerConfig,
        store.getState().document.head.timerState,
        Date.now(),
      ),
    ).toMatchObject({
      cadenceLabel: '15m cadence',
      remainingLabel: '15:00',
      statusLabel: 'Ready',
    });

    expect(store.getState().startTimer().ok).toBe(true);
    jest.advanceTimersByTime(61_000);

    expect(store.getState().pauseTimer().ok).toBe(true);
    expect(
      buildSharedTimerViewModel(
        store.getState().document.head.timerConfig,
        store.getState().document.head.timerState,
        Date.now(),
      ),
    ).toMatchObject({
      remainingLabel: '13:59',
      statusLabel: 'Paused',
    });

    expect(
      store.getState().updateTimerConfig({
        alarmDurationSeconds: 0,
        intervalMinutes: 0,
        intervalSeconds: 0,
      }).ok,
    ).toBe(true);
    expect(store.getState().document.head.timerConfig).toEqual({
      alarmDurationSeconds: 1,
      intervalMinutes: 0,
      intervalSeconds: 1,
    });

    expect(store.getState().startTimer().ok).toBe(true);
    expect(
      buildSharedTimerViewModel(
        store.getState().document.head.timerConfig,
        store.getState().document.head.timerState,
        Date.now(),
      ),
    ).toMatchObject({
      cadenceLabel: '15m cadence',
      remainingLabel: '13:59',
      statusLabel: 'Running',
    });

    expect(store.getState().resetTimer().ok).toBe(true);
    expect(
      buildSharedTimerViewModel(
        store.getState().document.head.timerConfig,
        store.getState().document.head.timerState,
        Date.now(),
      ),
    ).toMatchObject({
      remainingLabel: '00:01',
      statusLabel: 'Ready',
    });

    expect(store.getState().startTimer().ok).toBe(true);
    expect(
      buildSharedTimerViewModel(
        store.getState().document.head.timerConfig,
        store.getState().document.head.timerState,
        Date.now(),
      ),
    ).toMatchObject({
      cadenceLabel: '1s cadence',
      remainingLabel: '00:01',
      statusLabel: 'Running',
    });

    expect(
      deriveTransactionRows(store.getState().document).map((row) => ({
        isRestorable: row.isRestorable,
        isRestorableNow: row.isRestorableNow,
        participatesInHistory: row.participatesInHistory,
        summaryText: row.summaryText,
      })),
    ).toEqual([
      {
        isRestorable: false,
        isRestorableNow: false,
        participatesInHistory: false,
        summaryText: 'Started Timer',
      },
      {
        isRestorable: false,
        isRestorableNow: false,
        participatesInHistory: false,
        summaryText: 'Reset Timer',
      },
      {
        isRestorable: false,
        isRestorableNow: false,
        participatesInHistory: false,
        summaryText: 'Started Timer',
      },
      {
        isRestorable: true,
        isRestorableNow: false,
        participatesInHistory: true,
        summaryText: 'Updated Timer Settings',
      },
      {
        isRestorable: false,
        isRestorableNow: false,
        participatesInHistory: false,
        summaryText: 'Paused Timer',
      },
      {
        isRestorable: false,
        isRestorableNow: false,
        participatesInHistory: false,
        summaryText: 'Started Timer',
      },
    ]);
  });

  it('keeps the active countdown cadence frozen while running after config edits', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-timer-cadence-freeze',
      }),
      storage: createMemoryStorage(),
    });

    expect(
      store.getState().updateTimerConfig({
        intervalMinutes: 0,
        intervalSeconds: 5,
      }).ok,
    ).toBe(true);
    expect(store.getState().startTimer().ok).toBe(true);

    jest.advanceTimersByTime(2_000);

    expect(
      store.getState().updateTimerConfig({
        intervalMinutes: 0,
        intervalSeconds: 10,
      }).ok,
    ).toBe(true);

    expect(
      buildSharedTimerViewModel(
        store.getState().document.head.timerConfig,
        store.getState().document.head.timerState,
        Date.now(),
      ),
    ).toMatchObject({
      cadenceLabel: '5s cadence',
      remainingLabel: '00:03',
      statusLabel: 'Running',
    });

    expect(store.getState().resetTimer().ok).toBe(true);

    expect(
      buildSharedTimerViewModel(
        store.getState().document.head.timerConfig,
        store.getState().document.head.timerState,
        Date.now(),
      ),
    ).toMatchObject({
      cadenceLabel: '10s cadence',
      remainingLabel: '00:10',
      statusLabel: 'Ready',
    });
  });

  it('keeps timer lifecycle actions out of the history head and leaves the orphaned restore window open', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-timer-audit-window',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().setPoints(childId, 4).ok).toBe(true);

    const restoreTarget = deriveTransactionRows(store.getState().document).find(
      (row) => row.summaryText === 'Ava +1 Points [0 > 1]',
    );

    expect(
      store.getState().restoreTransaction(restoreTarget?.id ?? '').ok,
    ).toBe(true);

    const headTransactionIdBeforeTimerAction =
      store.getState().document.currentHeadTransactionId;

    expect(store.getState().startTimer().ok).toBe(true);
    jest.advanceTimersByTime(1_000);
    expect(store.getState().pauseTimer().ok).toBe(true);
    expect(store.getState().resetTimer().ok).toBe(true);

    expect(store.getState().document.currentHeadTransactionId).toBe(
      headTransactionIdBeforeTimerAction,
    );
    expect(store.getState().document.isOrphanedRestoreWindowOpen).toBe(true);
  });

  it('preserves the live timer state when restoring child history', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-timer-preserve-state-child-restore',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().setPoints(childId, 4).ok).toBe(true);
    expect(store.getState().startTimer().ok).toBe(true);
    jest.advanceTimersByTime(2_000);
    expect(store.getState().pauseTimer().ok).toBe(true);

    const timerStateBeforeRestore = store.getState().document.head.timerState;
    const restoreTarget = deriveTransactionRows(store.getState().document).find(
      (row) => row.summaryText === 'Ava +1 Points [0 > 1]',
    );

    expect(
      store.getState().restoreTransaction(restoreTarget?.id ?? '').ok,
    ).toBe(true);

    expect(store.getState().document.head.childrenById[childId]?.points).toBe(
      1,
    );
    expect(store.getState().document.head.timerState).toEqual(
      timerStateBeforeRestore,
    );
  });

  it('restores timer config without changing the live countdown state', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-timer-preserve-state-config-restore',
      }),
      storage: createMemoryStorage(),
    });

    expect(
      store.getState().updateTimerConfig({
        intervalMinutes: 0,
        intervalSeconds: 5,
      }).ok,
    ).toBe(true);
    expect(store.getState().startTimer().ok).toBe(true);
    jest.advanceTimersByTime(2_000);
    expect(
      store.getState().updateTimerConfig({
        intervalMinutes: 0,
        intervalSeconds: 10,
      }).ok,
    ).toBe(true);

    const timerStateBeforeRestore = store.getState().document.head.timerState;
    const restoreTarget = deriveTransactionRows(store.getState().document).find(
      (row) =>
        row.kind === 'timer-config-updated' &&
        row.stateAfter.timerConfig.intervalMinutes === 0 &&
        row.stateAfter.timerConfig.intervalSeconds === 5,
    );

    expect(
      store.getState().restoreTransaction(restoreTarget?.id ?? '').ok,
    ).toBe(true);

    expect(store.getState().document.head.timerConfig).toEqual({
      alarmDurationSeconds: 20,
      intervalMinutes: 0,
      intervalSeconds: 5,
    });
    expect(store.getState().document.head.timerState).toEqual(
      timerStateBeforeRestore,
    );
  });

  it('rehydrates legacy timer lifecycle transactions as audit-only while preserving timer state', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-timer-legacy-rehydrate',
      }),
      storage: createMemoryStorage(),
    });

    expect(
      store.getState().updateTimerConfig({
        intervalMinutes: 0,
        intervalSeconds: 5,
      }).ok,
    ).toBe(true);
    expect(store.getState().startTimer().ok).toBe(true);

    const persistedDocument = store.getState().document;
    const legacyTimerTransaction = persistedDocument.transactions.at(-1);
    const historyTransaction = persistedDocument.transactions.find(
      (transaction) => transaction.kind === 'timer-config-updated',
    );

    expect(legacyTimerTransaction).toBeTruthy();
    expect(historyTransaction).toBeTruthy();

    const rehydratedStore = createSharedStore({
      initialDocument: {
        ...persistedDocument,
        currentHeadTransactionId: legacyTimerTransaction?.id ?? null,
        transactions: persistedDocument.transactions.map((transaction) =>
          transaction.id === legacyTimerTransaction?.id
            ? {
                ...transaction,
                isRestorable: true,
                participatesInHistory: true,
              }
            : transaction,
        ),
      },
      storage: createMemoryStorage(),
    });
    const rows = deriveTransactionRows(rehydratedStore.getState().document);

    expect(rehydratedStore.getState().document.currentHeadTransactionId).toBe(
      historyTransaction?.id,
    );
    expect(rehydratedStore.getState().document.head.timerState).toEqual(
      persistedDocument.head.timerState,
    );
    expect(rows[0]).toMatchObject({
      isRestorable: false,
      isRestorableNow: false,
      kind: 'timer-started',
      participatesInHistory: false,
    });
  });

  it('clamps at zero and catches up from persisted state after resume', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-timer-b',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().startTimer().ok).toBe(true);
    const persistedDocument = store.getState().document;

    jest.advanceTimersByTime(15 * 60_000 + 5_000);

    expect(
      buildSharedTimerViewModel(
        persistedDocument.head.timerConfig,
        persistedDocument.head.timerState,
        Date.now(),
      ),
    ).toMatchObject({
      isExpired: true,
      remainingLabel: '00:00',
      statusLabel: 'Expired',
    });

    const rehydratedStore = createSharedStore({
      initialDocument: persistedDocument,
      storage: createMemoryStorage(),
    });

    expect(
      buildSharedTimerViewModel(
        rehydratedStore.getState().document.head.timerConfig,
        rehydratedStore.getState().document.head.timerState,
        Date.now(),
      ),
    ).toMatchObject({
      isExpired: true,
      remainingLabel: '00:00',
      statusLabel: 'Expired',
    });
  });
});

describe('sharedStore sync integration', () => {
  it('applies a validated sync bundle and records durable sync metadata', () => {
    const leftStorage = createMemoryStorage();
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-store-seed',
      }),
      storage: createMemoryStorage(),
    });

    expect(seedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = seedStore.getState().document.head.activeChildIds[0];

    if (!childId) {
      throw new Error('Expected sync integration fixture to create a child.');
    }

    expect(seedStore.getState().setPoints(childId, 5).ok).toBe(true);

    const leftStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-store-left',
      ),
      storage: leftStorage,
    });
    const rightStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-store-right',
      ),
      storage: createMemoryStorage(),
    });

    expect(leftStore.getState().setPoints(childId, 10).ok).toBe(true);
    expect(rightStore.getState().setPoints(childId, 10).ok).toBe(true);

    const preparedBundle = prepareSyncDeviceBundle({
      capturedAt: '2026-04-09T22:00:00.000Z',
      localDocument: leftStore.getState().document,
      remoteProjection: deriveSyncProjection(rightStore.getState().document),
    });

    if (!preparedBundle.ok) {
      throw new Error('Expected sync bundle preparation to succeed.');
    }

    expect(
      leftStore
        .getState()
        .applySyncBundle(
          preparedBundle.sharedBundle,
          preparedBundle.localRollbackSnapshot,
        ).ok,
    ).toBe(true);

    const document = leftStore.getState().document;
    const rows = deriveTransactionRows(document);

    expect(document.head.childrenById[childId]?.points).toBe(15);
    expect(document.transactions.at(-1)?.kind).toBe('sync-applied');
    expect(rows[0]?.summaryText).toBe('Applied Device Sync');
    expect(document.syncState?.lastAppliedSync).toMatchObject({
      appliedAt: expect.any(String),
      bundleHash: preparedBundle.sharedBundle.bundleHash,
      mergedHeadSyncHash: preparedBundle.sharedBundle.mergedHeadSyncHash,
      mode: 'merged',
    });
    expect(document.syncState?.lastRollbackSnapshot).toMatchObject({
      capturedAt: '2026-04-09T22:00:00.000Z',
      projectionHeadHash:
        preparedBundle.localRollbackSnapshot.projectionHeadHash,
      projectionHeadSyncHash:
        preparedBundle.localRollbackSnapshot.projectionHeadSyncHash,
    });
  });

  it('rehydrates persisted sync metadata after applying a bundle', () => {
    const sharedStorage = createMemoryStorage();
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-store-rehydrate-seed',
      }),
      storage: createMemoryStorage(),
    });

    expect(seedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = seedStore.getState().document.head.activeChildIds[0];

    if (!childId) {
      throw new Error('Expected rehydrate fixture to create a child.');
    }

    const leftStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-store-rehydrate-left',
      ),
      storage: sharedStorage,
    });
    const rightStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-store-rehydrate-right',
      ),
      storage: createMemoryStorage(),
    });

    expect(leftStore.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(rightStore.getState().adjustPoints(childId, 2).ok).toBe(true);

    const preparedBundle = prepareSyncDeviceBundle({
      capturedAt: '2026-04-09T22:05:00.000Z',
      localDocument: leftStore.getState().document,
      remoteProjection: deriveSyncProjection(rightStore.getState().document),
    });

    if (!preparedBundle.ok) {
      throw new Error('Expected sync bundle preparation to succeed.');
    }

    expect(
      leftStore
        .getState()
        .applySyncBundle(
          preparedBundle.sharedBundle,
          preparedBundle.localRollbackSnapshot,
        ).ok,
    ).toBe(true);

    const rehydratedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-store-rehydrate-left',
      }),
      storage: sharedStorage,
    });

    expect(
      rehydratedStore.getState().document.head.childrenById[childId]?.points,
    ).toBe(3);
    expect(
      rehydratedStore.getState().document.syncState?.lastAppliedSync,
    ).toMatchObject({
      bundleHash: preparedBundle.sharedBundle.bundleHash,
      mergedHeadSyncHash: preparedBundle.sharedBundle.mergedHeadSyncHash,
    });
    expect(
      rehydratedStore.getState().document.syncState?.lastRollbackSnapshot,
    ).toBeTruthy();
  });

  it('reverts the last applied sync back to the exact rollback snapshot', () => {
    const leftStorage = createMemoryStorage();
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-store-revert-seed',
      }),
      storage: createMemoryStorage(),
    });

    expect(seedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = seedStore.getState().document.head.activeChildIds[0];

    if (!childId) {
      throw new Error('Expected revert fixture to create a child.');
    }

    expect(seedStore.getState().setPoints(childId, 5).ok).toBe(true);

    const leftStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-store-revert-left',
      ),
      storage: leftStorage,
    });
    const rightStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-store-revert-right',
      ),
      storage: createMemoryStorage(),
    });

    expect(leftStore.getState().setPoints(childId, 10).ok).toBe(true);
    expect(rightStore.getState().setPoints(childId, 10).ok).toBe(true);

    const preparedBundle = prepareSyncDeviceBundle({
      capturedAt: '2026-04-09T22:10:00.000Z',
      localDocument: leftStore.getState().document,
      remoteProjection: deriveSyncProjection(rightStore.getState().document),
    });

    if (!preparedBundle.ok) {
      throw new Error('Expected sync bundle preparation to succeed.');
    }

    const rollbackDocument = preparedBundle.localRollbackSnapshot.document;

    expect(
      leftStore
        .getState()
        .applySyncBundle(
          preparedBundle.sharedBundle,
          preparedBundle.localRollbackSnapshot,
        ).ok,
    ).toBe(true);
    expect(
      leftStore.getState().document.head.childrenById[childId]?.points,
    ).toBe(15);

    expect(leftStore.getState().revertLastSync().ok).toBe(true);
    expect(leftStore.getState().document).toEqual({
      ...rollbackDocument,
      syncState: null,
    });
  });
});
