import {
  createInitialSharedDocument,
  createSharedStore,
  deriveTransactionRows,
} from '../../src/state/sharedStore';
import { buildSharedTimerViewModel } from '../../src/state/sharedTimer';
import { createMemoryStorage } from '../testUtils/memoryStorage';

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

  it('records one check-in transaction when multiple children are awarded together', () => {
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

    expect(store.getState().resolveCheckInSession([avaId, noahId]).ok).toBe(
      true,
    );

    const document = store.getState().document;
    const rows = deriveTransactionRows(document);

    expect(document.head.childrenById[avaId]?.points).toBe(1);
    expect(document.head.childrenById[noahId]?.points).toBe(1);
    expect(
      document.events.filter((event) => event.type === 'child.pointsAdjusted'),
    ).toHaveLength(2);
    expect(
      document.transactions.filter(
        (transaction) => transaction.kind === 'check-in-resolved',
      ),
    ).toHaveLength(1);
    expect(rows[0]?.summaryText).toBe('Check-In Awards +2 Points');
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
      deriveTransactionRows(store.getState().document).map(
        (row) => row.summaryText,
      ),
    ).toEqual([
      'Started Timer',
      'Reset Timer',
      'Started Timer',
      'Updated Timer Settings',
      'Paused Timer',
      'Started Timer',
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
