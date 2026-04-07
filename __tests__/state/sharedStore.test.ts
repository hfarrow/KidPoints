import {
  createInitialSharedDocument,
  createSharedStore,
  deriveTransactionRows,
  replaySharedDocument,
} from '../../src/state/sharedStore';
import { createMemoryStorage } from '../testUtils/memoryStorage';

describe('sharedStore transaction engine', () => {
  it('records critical actions, derives grouped transaction rows, and restores with new events', () => {
    const storage = createMemoryStorage();
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'device-a' }),
      storage,
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];

    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().setPoints(childId, 7).ok).toBe(true);

    const transactionRows = deriveTransactionRows(
      store.getState().document.events,
    );
    const groupedAdjustRow = transactionRows.find(
      (row) => row.summaryType === 'points-adjusted',
    );
    const exactSetRow = transactionRows.find(
      (row) => row.summaryType === 'points-set',
    );

    expect(groupedAdjustRow?.delta).toBe(2);
    expect(groupedAdjustRow?.eventIds).toHaveLength(2);
    expect(exactSetRow?.restoreDescriptor.target?.points).toBe(2);

    expect(store.getState().restoreTransaction(exactSetRow?.id ?? '').ok).toBe(
      true,
    );

    const document = store.getState().document;
    const replayedDocument = replaySharedDocument(document);

    expect(document.head.childrenById[childId]?.points).toBe(2);
    expect(replayedDocument.head).toEqual(document.head);
    expect(document.events.at(-1)?.type).toBe('child.pointsSet');
  });

  it('archives and restores children through recorded events', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'device-b' }),
      storage: createMemoryStorage(),
    });

    store.getState().addChild('Milo');
    const childId = store.getState().document.head.activeChildIds[0];

    expect(store.getState().archiveChild(childId).ok).toBe(true);
    expect(store.getState().document.head.archivedChildIds).toContain(childId);

    expect(store.getState().restoreChild(childId).ok).toBe(true);
    expect(store.getState().document.head.activeChildIds).toContain(childId);
    expect(store.getState().document.events.at(-1)?.type).toBe(
      'child.restored',
    );
  });

  it('records permanent deletion as non-restorable', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'device-c' }),
      storage: createMemoryStorage(),
    });

    store.getState().addChild('Noah');
    const childId = store.getState().document.head.activeChildIds[0];

    expect(store.getState().archiveChild(childId).ok).toBe(true);
    expect(store.getState().deleteChildPermanently(childId).ok).toBe(true);
    expect(
      store.getState().document.head.childrenById[childId],
    ).toBeUndefined();
    expect(store.getState().document.events.at(-1)?.type).toBe('child.deleted');

    const deleteRow = deriveTransactionRows(
      store.getState().document.events,
    ).find((row) => row.summaryType === 'child-deleted');

    expect(deleteRow?.restoreDescriptor.isRestorable).toBe(false);
    expect(deleteRow?.restoreDescriptor.target?.status).toBe('archived');
    expect(store.getState().restoreTransaction(deleteRow?.id ?? '').ok).toBe(
      false,
    );
    expect(
      store.getState().document.head.childrenById[childId],
    ).toBeUndefined();
  });

  it('restoring the initial child creation removes the child from the document', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({ deviceId: 'device-d' }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ivy').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];

    const creationRow = deriveTransactionRows(
      store.getState().document.events,
    ).find((row) => row.summaryType === 'child-created');

    expect(creationRow?.restoreDescriptor.target).toBeNull();
    expect(store.getState().restoreTransaction(creationRow?.id ?? '').ok).toBe(
      true,
    );
    expect(
      store.getState().document.head.childrenById[childId],
    ).toBeUndefined();
    expect(store.getState().document.head.activeChildIds).not.toContain(
      childId,
    );
    expect(store.getState().document.events.at(-1)?.type).toBe('child.deleted');
  });
});
