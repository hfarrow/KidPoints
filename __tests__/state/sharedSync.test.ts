import {
  cloneSharedDocument,
  createInitialSharedDocument,
  createSharedStore,
} from '../../src/state/sharedStore';
import {
  deriveSyncProjection,
  serializeSyncProjection,
} from '../../src/state/sharedSync';
import { createMemoryStorage } from '../testUtils/memoryStorage';

function expectChildId(
  document: ReturnType<typeof createInitialSharedDocument>,
) {
  const childId = document.head.activeChildIds[0];

  if (!childId) {
    throw new Error('Expected test fixture to create an active child.');
  }

  return childId;
}

describe('sharedSync phase 1 projection', () => {
  it('ignores local-only timer and audit changes when hashing the sync domain', () => {
    const baseStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-a',
      }),
      storage: createMemoryStorage(),
    });

    expect(baseStore.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(baseStore.getState().document);
    expect(baseStore.getState().adjustPoints(childId, 2).ok).toBe(true);

    const syncedProjection = deriveSyncProjection(
      baseStore.getState().document,
    );

    const noisyStore = createSharedStore({
      initialDocument: cloneSharedDocument(baseStore.getState().document),
      storage: createMemoryStorage(),
    });

    expect(
      noisyStore.getState().updateTimerConfig({
        alarmDurationSeconds: 3,
        intervalMinutes: 1,
        intervalSeconds: 5,
      }).ok,
    ).toBe(true);
    expect(noisyStore.getState().startTimer().ok).toBe(true);
    expect(noisyStore.getState().pauseTimer().ok).toBe(true);
    expect(noisyStore.getState().recordParentUnlockAttempt(false).ok).toBe(
      true,
    );

    const noisyProjection = deriveSyncProjection(
      noisyStore.getState().document,
    );

    expect(noisyProjection).toEqual(syncedProjection);
    expect(noisyProjection.headHash).toBe(syncedProjection.headHash);
    expect(noisyProjection.headSyncHash).toBe(syncedProjection.headSyncHash);
  });

  it('stays stable across equivalent object and child-id ordering differences', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-b',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    expect(store.getState().addChild('Noah').ok).toBe(true);
    const [avaId, noahId] = store.getState().document.head.activeChildIds;

    if (!avaId || !noahId) {
      throw new Error(
        'Expected ordering fixture to create two active children.',
      );
    }

    expect(store.getState().adjustPoints(noahId, 1).ok).toBe(true);
    const projection = deriveSyncProjection(store.getState().document);
    const reorderedDocument = cloneSharedDocument(store.getState().document);

    reorderedDocument.head.activeChildIds = [
      ...reorderedDocument.head.activeChildIds,
    ].reverse();
    reorderedDocument.head.childrenById = Object.fromEntries(
      [...Object.entries(reorderedDocument.head.childrenById)].reverse(),
    );

    const reorderedProjection = deriveSyncProjection(reorderedDocument);

    expect(reorderedProjection.head).toEqual(projection.head);
    expect(reorderedProjection.headHash).toBe(projection.headHash);
    expect(reorderedProjection.headSyncHash).toBe(projection.headSyncHash);
    expect(serializeSyncProjection(reorderedProjection)).toBe(
      serializeSyncProjection(projection),
    );
  });

  it('projects only the active syncable branch and excludes orphaned history', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-c',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(store.getState().document);
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().setPoints(childId, 4).ok).toBe(true);

    const restoreTarget = store
      .getState()
      .document.transactions.find(
        (transaction) =>
          transaction.kind === 'points-adjusted' &&
          transaction.pointsAfter === 1,
      );

    expect(
      store.getState().restoreTransaction(restoreTarget?.id ?? '').ok,
    ).toBe(true);

    const projection = deriveSyncProjection(store.getState().document);

    expect(projection.entries.map((entry) => entry.kind)).toEqual([
      'child-created',
      'points-adjusted',
      'history-restored',
    ]);
    expect(
      projection.entries.at(-1)?.stateAfter.childrenById[childId]?.points,
    ).toBe(1);
    expect(projection.head.childrenById[childId]?.points).toBe(1);
    expect(projection.headHash).toBe(projection.entries.at(-1)?.hash);
  });

  it('chains sync entry hashes from the active branch in oldest-first order', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-d',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(store.getState().document);
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);
    expect(store.getState().setPoints(childId, 7).ok).toBe(true);

    const projection = deriveSyncProjection(store.getState().document);
    const [createdEntry, adjustedEntry, setEntry] = projection.entries;

    expect(projection.entries).toHaveLength(3);
    expect(createdEntry?.parentHash).toBeNull();
    expect(adjustedEntry?.parentHash).toBe(createdEntry?.hash ?? null);
    expect(setEntry?.parentHash).toBe(adjustedEntry?.hash ?? null);
    expect(setEntry?.pointsBefore).toBe(1);
    expect(setEntry?.pointsAfter).toBe(7);
    expect(projection.headHash).toBe(setEntry?.hash);
  });
});
