import { buildSyncReviewModel } from '../../../src/features/sync/syncReview';
import {
  createSyncTestbedLocalSeedDocument,
  createSyncTestbedRemoteProjection,
  deriveSyncTestbedCommonBaseOptions,
  pickDefaultSyncTestbedCommonBaseTransactionId,
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
import type { SharedDocument } from '../../../src/state/sharedTypes';
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

function withSpacedTransactionTimestamps(document: SharedDocument) {
  const startTime = Date.parse(document.transactions[0]?.occurredAt ?? '');
  const baseTime = Number.isFinite(startTime)
    ? startTime
    : Date.parse('2026-01-01T12:00:00.000Z');

  return {
    ...document,
    transactions: document.transactions.map((transaction, index) => ({
      ...transaction,
      occurredAt: new Date(baseTime + index * 20_000).toISOString(),
    })),
  };
}

describe('syncTestbedFixtures', () => {
  it('remaps seeded local history origin to the testbed local device', () => {
    const sourceDocument = createSeededLocalDocument();
    const seededDocument = createSyncTestbedLocalSeedDocument({
      sourceDocument,
      strategyId: 'shared-base',
    });

    expect(seededDocument.deviceId).not.toBe(sourceDocument.deviceId);
    expect(
      seededDocument.transactions.map((transaction) => transaction.occurredAt),
    ).toEqual(
      sourceDocument.transactions.map((transaction) => transaction.occurredAt),
    );
    expect(
      seededDocument.transactions.every(
        (transaction) => transaction.originDeviceId === seededDocument.deviceId,
      ),
    ).toBe(true);
    expect(
      seededDocument.events.every(
        (event) => event.deviceId === seededDocument.deviceId,
      ),
    ).toBe(true);
  });

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

  it('keeps seeded local shared-base changes aligned to YOURS in the review model', () => {
    const sourceDocument = createSeededLocalDocument();
    const localDocument = createSyncTestbedLocalSeedDocument({
      sourceDocument,
      strategyId: 'shared-base',
    });
    const baseOptions = deriveSyncTestbedCommonBaseOptions(localDocument);
    const selectedTransactionId =
      pickDefaultSyncTestbedCommonBaseTransactionId(baseOptions);

    expect(selectedTransactionId).not.toBeNull();

    const remoteProjection = createSyncTestbedRemoteProjection({
      commonBaseTransactionId: selectedTransactionId,
      localDocument,
      storage: createMemoryStorage(),
      strategyId: 'shared-base',
    });
    const preparedBundle = prepareSyncDeviceBundle({
      localDocument,
      remoteProjection,
    });

    expect(preparedBundle.ok).toBe(true);

    if (!preparedBundle.ok || !selectedTransactionId) {
      throw new Error('Expected a prepared shared-base sync bundle');
    }

    const review = buildSyncReviewModel({
      bundle: preparedBundle.sharedBundle,
      localDeviceId: localDocument.deviceId,
      localProjection: preparedBundle.localProjection,
      remoteProjection,
    });

    expect(review.transactions.some((item) => item.origin === 'local')).toBe(
      true,
    );
    expect(review.transactions.some((item) => item.origin === 'base')).toBe(
      true,
    );
    expect(review.transactions.some((item) => item.origin === 'remote')).toBe(
      true,
    );
  });

  it('interleaves shared-base review history between local and remote timestamps', () => {
    const sourceDocument = createSeededLocalDocument();
    const localDocument = withSpacedTransactionTimestamps(
      createSyncTestbedLocalSeedDocument({
        sourceDocument,
        strategyId: 'shared-base',
      }),
    );
    const selectedTransactionId =
      deriveSyncTestbedCommonBaseOptions(localDocument)
        .filter((option) => option.isMergeSafe)
        .at(-1)?.id ?? null;

    expect(selectedTransactionId).not.toBeNull();

    const remoteProjection = createSyncTestbedRemoteProjection({
      commonBaseTransactionId: selectedTransactionId,
      localDocument,
      storage: createMemoryStorage(),
      strategyId: 'shared-base',
    });
    const preparedBundle = prepareSyncDeviceBundle({
      localDocument,
      remoteProjection,
    });

    expect(preparedBundle.ok).toBe(true);

    if (!preparedBundle.ok) {
      throw new Error('Expected a prepared shared-base sync bundle');
    }

    const review = buildSyncReviewModel({
      bundle: preparedBundle.sharedBundle,
      localDeviceId: localDocument.deviceId,
      localProjection: preparedBundle.localProjection,
      remoteProjection,
    });
    const adjacentOrigins = review.transactions.map(
      (transaction) => transaction.origin,
    );

    expect(adjacentOrigins.length).toBeGreaterThanOrEqual(4);
    expect(adjacentOrigins.slice(0, 4)).toEqual([
      'remote',
      'local',
      'remote',
      'local',
    ]);
    expect(adjacentOrigins.at(-1)).toBe('base');
  });
});
