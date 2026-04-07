import {
  createInitialSharedDocument,
  createSharedStore,
  deriveTransactionRows,
} from '../../src/state/sharedStore';
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
});
