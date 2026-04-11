import {
  createSyncTestbedRemoteProjection,
  deriveSyncTestbedCommonBaseOptions,
} from '../../../src/features/sync/syncTestbedFixtures';
import {
  createSharedStore,
  deriveTransactionRows,
} from '../../../src/state/sharedStore';
import {
  deriveSyncProjection,
  prepareSyncDeviceBundle,
  resolveCommonSyncBase,
} from '../../../src/state/sharedSync';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

function createSeededLocalDocument() {
  const store = createSharedStore({
    storage: createMemoryStorage(),
  });

  store.getState().addChild('Maya');
  const childId = store.getState().document.head.activeChildIds[0];

  if (!childId) {
    throw new Error('Expected a child id in the seeded local document.');
  }

  store.getState().setPoints(childId, 2);
  store.getState().adjustPoints(childId, 5);

  return store.getState().document;
}

describe('syncTestbedFixtures', () => {
  it('creates an empty remote projection for left bootstrap previews', () => {
    const localDocument = createSeededLocalDocument();
    const localProjection = deriveSyncProjection(localDocument);
    const remoteProjection = createSyncTestbedRemoteProjection({
      commonBaseTransactionId: null,
      localDocument,
      storage: createMemoryStorage(),
      strategyId: 'bootstrap-left-to-right',
    });

    expect(
      resolveCommonSyncBase({
        leftProjection: localProjection,
        rightProjection: remoteProjection,
      }),
    ).toMatchObject({
      mode: 'bootstrap-left-to-right',
      ok: true,
    });
  });

  it('creates seeded remote history for right bootstrap previews', () => {
    const localDocument = createSharedStore({
      storage: createMemoryStorage(),
    }).getState().document;
    const remoteProjection = createSyncTestbedRemoteProjection({
      commonBaseTransactionId: null,
      localDocument,
      storage: createMemoryStorage(),
      strategyId: 'bootstrap-right-to-left',
    });

    expect(
      resolveCommonSyncBase({
        leftProjection: deriveSyncProjection(localDocument),
        rightProjection: remoteProjection,
      }),
    ).toMatchObject({
      mode: 'bootstrap-right-to-left',
      ok: true,
    });
  });

  it('branches shared-base remote history from a selected syncable transaction', () => {
    const localDocument = createSeededLocalDocument();
    const rows = deriveTransactionRows(localDocument);
    const options = deriveSyncTestbedCommonBaseOptions(localDocument);
    const selectedTransactionId =
      options.find((option) => option.isMergeSafe && !option.isHead)?.id ??
      options.find((option) => option.isMergeSafe)?.id ??
      null;

    expect(selectedTransactionId).not.toBeNull();

    const remoteProjection = createSyncTestbedRemoteProjection({
      commonBaseTransactionId: selectedTransactionId,
      localDocument,
      storage: createMemoryStorage(),
      strategyId: 'shared-base',
    });
    const localProjection = deriveSyncProjection(localDocument);
    const commonBaseResult = resolveCommonSyncBase({
      leftProjection: localProjection,
      rightProjection: remoteProjection,
    });

    expect(commonBaseResult).toMatchObject({
      mode: 'shared-base',
      ok: true,
    });

    expect(
      prepareSyncDeviceBundle({
        localDocument,
        remoteProjection,
      }).ok,
    ).toBe(true);
    expect(rows.some((row) => row.id === selectedTransactionId)).toBe(true);
  });
});
