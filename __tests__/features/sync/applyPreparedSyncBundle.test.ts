import { applyPreparedSyncBundle } from '../../../src/features/sync/applyPreparedSyncBundle';
import {
  cloneSharedDocument,
  createInitialSharedDocument,
  createSharedStore,
} from '../../../src/state/sharedStore';
import {
  deriveSyncProjection,
  prepareSyncDeviceBundle,
} from '../../../src/state/sharedSync';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

describe('applyPreparedSyncBundle', () => {
  it('creates a pre-sync backup before applying a prepared bundle', async () => {
    const baseStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'apply-prepared-base',
      }),
      storage: createMemoryStorage(),
    });

    expect(baseStore.getState().addChild('Ava').ok).toBe(true);
    const baseDocument = baseStore.getState().document;
    const leftStore = createSharedStore({
      initialDocument: {
        ...cloneSharedDocument(baseDocument),
        deviceId: 'apply-prepared-left',
      },
      storage: createMemoryStorage(),
    });
    const rightStore = createSharedStore({
      initialDocument: {
        ...cloneSharedDocument(baseDocument),
        deviceId: 'apply-prepared-right',
      },
      storage: createMemoryStorage(),
    });

    const leftChildId = leftStore.getState().document.head.activeChildIds[0];
    const rightChildId = rightStore.getState().document.head.activeChildIds[0];

    if (!leftChildId || !rightChildId) {
      throw new Error(
        'Expected applyPreparedSyncBundle fixture to create children.',
      );
    }

    expect(leftStore.getState().adjustPoints(leftChildId, 2).ok).toBe(true);
    expect(rightStore.getState().adjustPoints(rightChildId, 3).ok).toBe(true);

    const preparedBundle = prepareSyncDeviceBundle({
      capturedAt: '2026-04-19T22:20:00.000Z',
      localDocument: leftStore.getState().document,
      remoteProjection: deriveSyncProjection(rightStore.getState().document),
    });

    if (!preparedBundle.ok) {
      throw new Error('Expected prepared bundle fixture to succeed.');
    }

    const mockCreateBackup = jest.fn(async () => ({
      metadata: null,
      ok: true as const,
      source: 'local' as const,
    }));
    const mockApplySyncBundle = jest.fn(() =>
      leftStore
        .getState()
        .applySyncBundle(
          preparedBundle.sharedBundle,
          preparedBundle.localRollbackSnapshot,
        ),
    );

    await expect(
      applyPreparedSyncBundle({
        applySyncBundle: mockApplySyncBundle,
        bundleHash: preparedBundle.sharedBundle.bundleHash,
        createBackup: mockCreateBackup,
        currentDocument: leftStore.getState().document,
        preparedBundle,
      }),
    ).resolves.toEqual({ ok: true });

    expect(mockCreateBackup).toHaveBeenCalledWith('pre-sync');
    expect(mockApplySyncBundle).toHaveBeenCalledTimes(1);
  });

  it('stops the sync apply when the pre-sync backup fails', async () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'apply-prepared-failure',
      }),
      storage: createMemoryStorage(),
    });
    const projection = deriveSyncProjection(store.getState().document);
    const preparedBundle = {
      localRollbackSnapshot: {
        capturedAt: '2026-04-19T22:40:00.000Z',
        document: store.getState().document,
        projectionHeadHash: 'head-1',
        projectionHeadSyncHash: 'sync-1',
      },
      sharedBundle: {
        bootstrapHistory: null,
        bundleHash: 'bundle-1',
        childReconciliations: [],
        commonBaseHash: null,
        mergedHead: projection.head,
        mergedHeadSyncHash: 'merged-sync-1',
        mode: 'merged' as const,
        participantHeadHashes: ['left', 'right'],
        participantHeadSyncHashes: ['left-sync', 'right-sync'],
        syncSchemaVersion: 2 as const,
      },
    };
    const mockCreateBackup = jest.fn(async () => ({
      error: 'Backup failed.',
      ok: false as const,
    }));
    const mockApplySyncBundle = jest.fn(() => ({ ok: true as const }));

    await expect(
      applyPreparedSyncBundle({
        applySyncBundle: mockApplySyncBundle,
        bundleHash: 'bundle-1',
        createBackup: mockCreateBackup,
        currentDocument: store.getState().document,
        preparedBundle,
      }),
    ).resolves.toEqual({
      error: 'Backup failed.',
      ok: false,
    });

    expect(mockApplySyncBundle).not.toHaveBeenCalled();
  });
});
