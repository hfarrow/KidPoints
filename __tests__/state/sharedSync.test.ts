import {
  cloneSharedDocument,
  createInitialSharedDocument,
  createSharedStore,
} from '../../src/state/sharedStore';
import {
  CURRENT_SYNC_SCHEMA_VERSION,
  captureSyncRollbackSnapshot,
  confirmSyncBundleAgreement,
  deriveSyncProjection,
  prepareSyncDeviceBundle,
  reconcileSyncProjections,
  resolveCommonSyncBase,
  serializeSyncBundle,
  serializeSyncProjection,
  validateSyncProjection,
} from '../../src/state/sharedSync';
import type { SharedDocument } from '../../src/state/sharedTypes';
import { createMemoryStorage } from '../testUtils/memoryStorage';

function createShopImage(overrides?: {
  base64?: string;
  height?: number;
  mimeType?: string;
  width?: number;
}) {
  return {
    aspectRatio: '4:3' as const,
    base64: overrides?.base64 ?? 'fixture-image-base64',
    height: overrides?.height ?? 300,
    mimeType: overrides?.mimeType ?? 'image/jpeg',
    width: overrides?.width ?? 400,
  };
}

function expectChildId(
  document: ReturnType<typeof createInitialSharedDocument>,
) {
  const childId = document.head.activeChildIds[0];

  if (!childId) {
    throw new Error('Expected test fixture to create an active child.');
  }

  return childId;
}

function cloneDocumentForDevice(document: SharedDocument, deviceId: string) {
  return {
    ...cloneSharedDocument(document),
    deviceId,
  } satisfies SharedDocument;
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
    expect(projection.syncSchemaVersion).toBe(CURRENT_SYNC_SCHEMA_VERSION);
    expect(
      projection.entries.at(-1)?.stateAfter.childrenById[childId]?.points,
    ).toBe(1);
    expect(projection.head.childrenById[childId]?.points).toBe(1);
    expect(projection.headHash).toBe(projection.entries.at(-1)?.hash);
    expect(projection.entries.at(-1)).toMatchObject({
      occurredAt: expect.any(String),
      restoredFromTransactionId: expect.any(String),
      restoredToTransactionId: restoreTarget?.id,
    });
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

  it('projects shop catalog state and purchase metadata into the sync domain', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-shop-projection',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(store.getState().document);
    expect(store.getState().setPoints(childId, 10).ok).toBe(true);
    expect(
      store.getState().createShopSku({
        image: createShopImage({ base64: 'puzzle' }),
        name: 'Puzzle',
        pointCost: 4,
      }).ok,
    ).toBe(true);

    const skuId = store.getState().document.head.shop.skuOrder[0];

    if (!skuId) {
      throw new Error(
        'Expected a shop item before deriving the sync projection.',
      );
    }

    expect(
      store.getState().completeShopPurchase(childId, [{ quantity: 2, skuId }])
        .ok,
    ).toBe(true);

    const projection = deriveSyncProjection(store.getState().document);
    const purchaseEntry = projection.entries.at(-1);

    expect(projection.scope).toBe('family-ledger');
    expect(projection.head.shop).toEqual(store.getState().document.head.shop);
    expect(projection.entries.map((entry) => entry.kind)).toEqual([
      'child-created',
      'points-set',
      'shop-sku-created',
      'shop-purchase-completed',
    ]);
    expect(purchaseEntry).toMatchObject({
      childId,
      kind: 'shop-purchase-completed',
      pointsAfter: 2,
      pointsBefore: 10,
      shopPurchaseItems: [
        {
          lineTotal: 8,
          pointCost: 4,
          quantity: 2,
          skuId,
          skuName: 'Puzzle',
        },
      ],
      shopPurchaseTotalCost: 8,
    });
  });

  it('rejects projections from an older sync schema version', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-legacy-schema',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);

    const legacyProjection = {
      ...deriveSyncProjection(store.getState().document),
      syncSchemaVersion: 1 as const,
    };

    expect(
      validateSyncProjection(
        legacyProjection as never as ReturnType<typeof deriveSyncProjection>,
      ),
    ).toEqual({
      code: 'sync-schema-version-mismatch',
      message: `Unsupported sync schema version: 1. Expected ${CURRENT_SYNC_SCHEMA_VERSION}.`,
      ok: false,
    });
  });
});

describe('sharedSync phase 2 common base detection', () => {
  it('finds the latest shared sync base after the devices diverge', () => {
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-base-seed',
      }),
      storage: createMemoryStorage(),
    });

    expect(seedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(seedStore.getState().document);
    expect(seedStore.getState().adjustPoints(childId, 1).ok).toBe(true);

    const leftStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-base-left',
      ),
      storage: createMemoryStorage(),
    });
    const rightStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-base-right',
      ),
      storage: createMemoryStorage(),
    });

    expect(leftStore.getState().setPoints(childId, 4).ok).toBe(true);
    expect(rightStore.getState().adjustPoints(childId, 2).ok).toBe(true);

    const leftProjection = deriveSyncProjection(leftStore.getState().document);
    const rightProjection = deriveSyncProjection(
      rightStore.getState().document,
    );
    const result = resolveCommonSyncBase({
      leftProjection,
      rightProjection,
    });

    expect(result).toMatchObject({
      commonBaseHash: leftProjection.entries[1]?.hash,
      leftBaseIndex: 1,
      mode: 'shared-base',
      ok: true,
      rightBaseIndex: 1,
    });
    if (!result.ok || result.mode !== 'shared-base') {
      throw new Error('Expected a shared-base common sync result.');
    }
    expect(result.commonBaseEntry?.kind).toBe('points-adjusted');
    expect(result.commonBaseEntry?.pointsAfter).toBe(1);
  });

  it('allows bootstrap from a populated device into an empty device', () => {
    const populatedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-bootstrap-source',
      }),
      storage: createMemoryStorage(),
    });
    const emptyStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-bootstrap-target',
      }),
      storage: createMemoryStorage(),
    });

    expect(populatedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(populatedStore.getState().document);
    expect(populatedStore.getState().adjustPoints(childId, 3).ok).toBe(true);

    const result = resolveCommonSyncBase({
      leftProjection: deriveSyncProjection(populatedStore.getState().document),
      rightProjection: deriveSyncProjection(emptyStore.getState().document),
    });

    expect(result).toEqual({
      commonBaseHash: null,
      mode: 'bootstrap-left-to-right',
      ok: true,
    });
  });

  it('rejects independent initialized histories that do not share a base', () => {
    const leftStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-independent-left',
      }),
      storage: createMemoryStorage(),
    });
    const rightStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-independent-right',
      }),
      storage: createMemoryStorage(),
    });

    expect(leftStore.getState().addChild('Ava').ok).toBe(true);
    expect(rightStore.getState().addChild('Noah').ok).toBe(true);

    const result = resolveCommonSyncBase({
      leftProjection: deriveSyncProjection(leftStore.getState().document),
      rightProjection: deriveSyncProjection(rightStore.getState().document),
    });

    expect(result).toEqual({
      code: 'independent-lineages',
      message:
        'The devices do not share a common sync base and cannot bootstrap over existing ledger history.',
      ok: false,
    });
  });

  it('rejects projections whose hash chain has been tampered with', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-invalid-chain',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(store.getState().document);
    expect(store.getState().adjustPoints(childId, 1).ok).toBe(true);

    const validProjection = deriveSyncProjection(store.getState().document);
    const invalidProjection = {
      ...validProjection,
      entries: validProjection.entries.map((entry, index) =>
        index === 1
          ? {
              ...entry,
              parentHash: 'sync-tampered-parent',
            }
          : entry,
      ),
    };

    expect(validateSyncProjection(invalidProjection)).toEqual({
      code: 'entry-parent-hash-mismatch',
      entryHash: invalidProjection.entries[1]?.hash,
      entryIndex: 1,
      message: 'Sync entry 1 has an unexpected parent hash.',
      ok: false,
    });

    expect(
      resolveCommonSyncBase({
        leftProjection: invalidProjection,
        rightProjection: validProjection,
      }),
    ).toEqual({
      code: 'invalid-left-projection',
      message: 'Sync entry 1 has an unexpected parent hash.',
      ok: false,
    });
  });
});

describe('sharedSync phase 3 reconciliation', () => {
  it('merges point totals from the common base by summing both sides deltas', () => {
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-reconcile-seed',
      }),
      storage: createMemoryStorage(),
    });

    expect(seedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(seedStore.getState().document);
    expect(seedStore.getState().setPoints(childId, 5).ok).toBe(true);

    const leftStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-reconcile-left',
      ),
      storage: createMemoryStorage(),
    });
    const rightStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-reconcile-right',
      ),
      storage: createMemoryStorage(),
    });

    expect(leftStore.getState().setPoints(childId, 10).ok).toBe(true);
    expect(rightStore.getState().setPoints(childId, 10).ok).toBe(true);

    const result = reconcileSyncProjections({
      leftProjection: deriveSyncProjection(leftStore.getState().document),
      rightProjection: deriveSyncProjection(rightStore.getState().document),
    });

    expect(result).toMatchObject({
      mode: 'merged',
      ok: true,
    });
    if (!result.ok || result.mode !== 'merged') {
      throw new Error('Expected merged sync reconciliation result.');
    }
    expect(result.mergedHead.childrenById[childId]?.points).toBe(15);
    expect(result.childReconciliations).toEqual([
      {
        basePoints: 5,
        childId,
        childName: 'Ava',
        leftDelta: 5,
        leftPoints: 10,
        mergedPoints: 15,
        rightDelta: 5,
        rightPoints: 10,
      },
    ]);
  });

  it('supports one-sided and negative point changes across multiple children', () => {
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-reconcile-multi',
      }),
      storage: createMemoryStorage(),
    });

    expect(seedStore.getState().addChild('Ava').ok).toBe(true);
    expect(seedStore.getState().addChild('Noah').ok).toBe(true);
    const [avaId, noahId] = seedStore.getState().document.head.activeChildIds;

    if (!avaId || !noahId) {
      throw new Error(
        'Expected multi-child reconciliation fixture to create two children.',
      );
    }

    expect(seedStore.getState().setPoints(avaId, 10).ok).toBe(true);
    expect(seedStore.getState().setPoints(noahId, 2).ok).toBe(true);

    const leftStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-reconcile-multi-left',
      ),
      storage: createMemoryStorage(),
    });
    const rightStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-reconcile-multi-right',
      ),
      storage: createMemoryStorage(),
    });

    expect(leftStore.getState().setPoints(avaId, 8).ok).toBe(true);
    expect(rightStore.getState().setPoints(avaId, 7).ok).toBe(true);
    expect(rightStore.getState().adjustPoints(noahId, 4).ok).toBe(true);

    const result = reconcileSyncProjections({
      leftProjection: deriveSyncProjection(leftStore.getState().document),
      rightProjection: deriveSyncProjection(rightStore.getState().document),
    });

    expect(result).toMatchObject({
      mode: 'merged',
      ok: true,
    });
    if (!result.ok || result.mode !== 'merged') {
      throw new Error('Expected merged sync reconciliation result.');
    }

    expect(result.mergedHead.childrenById[avaId]?.points).toBe(5);
    expect(result.mergedHead.childrenById[noahId]?.points).toBe(6);
    expect(result.childReconciliations).toEqual(
      [
        {
          basePoints: 10,
          childId: avaId,
          childName: 'Ava',
          leftDelta: -2,
          leftPoints: 8,
          mergedPoints: 5,
          rightDelta: -3,
          rightPoints: 7,
        },
        {
          basePoints: 2,
          childId: noahId,
          childName: 'Noah',
          leftDelta: 0,
          leftPoints: 2,
          mergedPoints: 6,
          rightDelta: 4,
          rightPoints: 6,
        },
      ].sort((left, right) => left.childId.localeCompare(right.childId)),
    );
  });

  it('returns the populated side during bootstrap reconciliation', () => {
    const populatedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-reconcile-bootstrap',
      }),
      storage: createMemoryStorage(),
    });
    const emptyStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-reconcile-empty',
      }),
      storage: createMemoryStorage(),
    });

    expect(populatedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(populatedStore.getState().document);
    expect(populatedStore.getState().adjustPoints(childId, 3).ok).toBe(true);

    const result = reconcileSyncProjections({
      leftProjection: deriveSyncProjection(populatedStore.getState().document),
      rightProjection: deriveSyncProjection(emptyStore.getState().document),
    });

    expect(result).toEqual({
      childReconciliations: [],
      commonBaseHash: null,
      mergedHead: deriveSyncProjection(populatedStore.getState().document).head,
      mergedHeadSyncHash: deriveSyncProjection(
        populatedStore.getState().document,
      ).headSyncHash,
      mode: 'bootstrap-left-to-right',
      ok: true,
    });
  });

  it('rejects unsupported post-base child lifecycle mutations', () => {
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-reconcile-unsupported',
      }),
      storage: createMemoryStorage(),
    });

    expect(seedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(seedStore.getState().document);

    const leftStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-reconcile-unsupported-left',
      ),
      storage: createMemoryStorage(),
    });
    const rightStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-reconcile-unsupported-right',
      ),
      storage: createMemoryStorage(),
    });

    expect(leftStore.getState().archiveChild(childId).ok).toBe(true);
    expect(rightStore.getState().adjustPoints(childId, 1).ok).toBe(true);

    const leftProjection = deriveSyncProjection(leftStore.getState().document);
    const result = reconcileSyncProjections({
      leftProjection,
      rightProjection: deriveSyncProjection(rightStore.getState().document),
    });

    expect(result).toEqual({
      childId,
      code: 'child-shape-mismatch',
      message:
        'The devices disagree about a child outside of point totals, which Phase 3 does not reconcile.',
      ok: false,
    });
  });

  it('merges one-sided shop catalog changes into the shared sync head', () => {
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-shop-merge-seed',
      }),
      storage: createMemoryStorage(),
    });

    expect(
      seedStore.getState().createShopSku({
        image: createShopImage({ base64: 'cards' }),
        name: 'Cards',
        pointCost: 3,
      }).ok,
    ).toBe(true);

    const skuId = seedStore.getState().document.head.shop.skuOrder[0];

    if (!skuId) {
      throw new Error('Expected a seeded shop item before reconciliation.');
    }

    const leftStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-shop-merge-left',
      ),
      storage: createMemoryStorage(),
    });
    const rightStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-shop-merge-right',
      ),
      storage: createMemoryStorage(),
    });

    expect(
      leftStore.getState().updateShopSku(skuId, {
        image: createShopImage({
          base64: 'cards-updated',
          height: 600,
          width: 800,
        }),
        name: 'Cards Deluxe',
        pointCost: 6,
      }).ok,
    ).toBe(true);

    const result = reconcileSyncProjections({
      leftProjection: deriveSyncProjection(leftStore.getState().document),
      rightProjection: deriveSyncProjection(rightStore.getState().document),
    });

    expect(result).toMatchObject({
      childReconciliations: [],
      mode: 'merged',
      ok: true,
    });
    if (!result.ok) {
      throw new Error('Expected the shop reconciliation to succeed.');
    }

    expect(result.mergedHead.shop.skuOrder).toEqual([skuId]);
    expect(result.mergedHead.shop.skusById[skuId]).toMatchObject({
      id: skuId,
      image: createShopImage({
        base64: 'cards-updated',
        height: 600,
        width: 800,
      }),
      name: 'Cards Deluxe',
      pointCost: 6,
    });
  });

  it('rejects conflicting shop edits that touch the same SKU differently', () => {
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-shop-conflict-seed',
      }),
      storage: createMemoryStorage(),
    });

    expect(
      seedStore.getState().createShopSku({
        image: createShopImage({ base64: 'paint' }),
        name: 'Paint Set',
        pointCost: 4,
      }).ok,
    ).toBe(true);

    const skuId = seedStore.getState().document.head.shop.skuOrder[0];

    if (!skuId) {
      throw new Error('Expected a seeded shop item before conflict testing.');
    }

    const leftStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-shop-conflict-left',
      ),
      storage: createMemoryStorage(),
    });
    const rightStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-shop-conflict-right',
      ),
      storage: createMemoryStorage(),
    });

    expect(
      leftStore.getState().updateShopSku(skuId, {
        image: createShopImage({ base64: 'paint-left' }),
        name: 'Paint Set Left',
        pointCost: 5,
      }).ok,
    ).toBe(true);
    expect(
      rightStore.getState().updateShopSku(skuId, {
        image: createShopImage({ base64: 'paint-right' }),
        name: 'Paint Set Right',
        pointCost: 6,
      }).ok,
    ).toBe(true);

    expect(
      reconcileSyncProjections({
        leftProjection: deriveSyncProjection(leftStore.getState().document),
        rightProjection: deriveSyncProjection(rightStore.getState().document),
      }),
    ).toMatchObject({
      code: 'shop-state-mismatch',
      entryKind: 'shop-sku-updated',
      message:
        'The devices changed the same shop item in different ways, which this sync phase does not reconcile.',
      ok: false,
    });
  });
});

describe('sharedSync phase 4 agreement bundle', () => {
  it('lets both devices derive the same shared bundle and agree on the merged head hash', () => {
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-phase4-seed',
      }),
      storage: createMemoryStorage(),
    });

    expect(seedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(seedStore.getState().document);
    expect(seedStore.getState().setPoints(childId, 5).ok).toBe(true);

    const leftDocument = cloneDocumentForDevice(
      seedStore.getState().document,
      'device-sync-phase4-left',
    );
    const rightDocument = cloneDocumentForDevice(
      seedStore.getState().document,
      'device-sync-phase4-right',
    );
    const leftStore = createSharedStore({
      initialDocument: leftDocument,
      storage: createMemoryStorage(),
    });
    const rightStore = createSharedStore({
      initialDocument: rightDocument,
      storage: createMemoryStorage(),
    });

    expect(leftStore.getState().setPoints(childId, 10).ok).toBe(true);
    expect(rightStore.getState().setPoints(childId, 10).ok).toBe(true);

    const leftPlan = prepareSyncDeviceBundle({
      capturedAt: '2026-04-09T20:00:00.000Z',
      localDocument: leftStore.getState().document,
      remoteProjection: deriveSyncProjection(rightStore.getState().document),
    });
    const rightPlan = prepareSyncDeviceBundle({
      capturedAt: '2026-04-09T20:00:01.000Z',
      localDocument: rightStore.getState().document,
      remoteProjection: deriveSyncProjection(leftStore.getState().document),
    });

    if (!leftPlan.ok || !rightPlan.ok) {
      throw new Error('Expected both devices to prepare valid sync bundles.');
    }

    expect(leftPlan.sharedBundle.mergedHead.childrenById[childId]?.points).toBe(
      15,
    );
    expect(leftPlan.sharedBundle).toEqual(rightPlan.sharedBundle);
    expect(serializeSyncBundle(leftPlan.sharedBundle)).toBe(
      serializeSyncBundle(rightPlan.sharedBundle),
    );
    expect(
      confirmSyncBundleAgreement({
        leftBundle: leftPlan.sharedBundle,
        rightBundle: rightPlan.sharedBundle,
      }),
    ).toEqual({
      agreedBundleHash: leftPlan.sharedBundle.bundleHash,
      agreedHeadSyncHash: leftPlan.sharedBundle.mergedHeadSyncHash,
      ok: true,
    });
  });

  it('includes identical bootstrap history payloads when syncing from a populated device into an empty device', () => {
    const populatedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-phase4-bootstrap-source',
      }),
      storage: createMemoryStorage(),
    });
    const emptyStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-phase4-bootstrap-target',
      }),
      storage: createMemoryStorage(),
    });

    expect(populatedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(populatedStore.getState().document);
    expect(populatedStore.getState().setPoints(childId, 5).ok).toBe(true);

    const populatedProjection = deriveSyncProjection(
      populatedStore.getState().document,
    );
    const leftPlan = prepareSyncDeviceBundle({
      localDocument: populatedStore.getState().document,
      remoteProjection: deriveSyncProjection(emptyStore.getState().document),
    });
    const rightPlan = prepareSyncDeviceBundle({
      localDocument: emptyStore.getState().document,
      remoteProjection: populatedProjection,
    });

    if (!leftPlan.ok || !rightPlan.ok) {
      throw new Error('Expected bootstrap bundle preparation to succeed.');
    }

    expect(leftPlan.sharedBundle).toEqual(rightPlan.sharedBundle);
    expect(leftPlan.sharedBundle.mode).toBe('bootstrap');
    expect(leftPlan.sharedBundle.bootstrapHistory).toEqual(
      populatedProjection.entries,
    );
    expect(serializeSyncBundle(leftPlan.sharedBundle)).toBe(
      serializeSyncBundle(rightPlan.sharedBundle),
    );
  });

  it('rejects agreement when merged head hashes differ', () => {
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-phase4-mismatch',
      }),
      storage: createMemoryStorage(),
    });

    expect(seedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(seedStore.getState().document);
    expect(seedStore.getState().adjustPoints(childId, 1).ok).toBe(true);

    const leftPlan = prepareSyncDeviceBundle({
      localDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-phase4-mismatch-left',
      ),
      remoteProjection: deriveSyncProjection(
        cloneDocumentForDevice(
          seedStore.getState().document,
          'device-sync-phase4-mismatch-right',
        ),
      ),
    });

    if (!leftPlan.ok) {
      throw new Error('Expected the left device plan to succeed.');
    }

    const tamperedBundle = {
      ...leftPlan.sharedBundle,
      mergedHeadSyncHash: 'sync-tampered-head',
    };

    expect(
      confirmSyncBundleAgreement({
        leftBundle: leftPlan.sharedBundle,
        rightBundle: tamperedBundle,
      }),
    ).toEqual({
      code: 'merged-head-sync-hash-mismatch',
      message:
        'The devices derived different merged sync head hashes and must not commit the sync.',
      ok: false,
    });
  });

  it('rejects agreement when the shared bundle hash differs despite the same merged head hash', () => {
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-phase4-bundle-mismatch',
      }),
      storage: createMemoryStorage(),
    });

    expect(seedStore.getState().addChild('Ava').ok).toBe(true);

    const leftPlan = prepareSyncDeviceBundle({
      localDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-phase4-bundle-left',
      ),
      remoteProjection: deriveSyncProjection(
        cloneDocumentForDevice(
          seedStore.getState().document,
          'device-sync-phase4-bundle-right',
        ),
      ),
    });

    if (!leftPlan.ok) {
      throw new Error('Expected the left device plan to succeed.');
    }

    const tamperedBundle = {
      ...leftPlan.sharedBundle,
      bundleHash: 'sync-tampered-bundle',
    };

    expect(
      confirmSyncBundleAgreement({
        leftBundle: leftPlan.sharedBundle,
        rightBundle: tamperedBundle,
      }),
    ).toEqual({
      code: 'bundle-hash-mismatch',
      message:
        'The devices derived different sync bundles and must not commit the sync.',
      ok: false,
    });
  });

  it('captures an exact rollback snapshot of the local document before sync', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-phase4-rollback',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = expectChildId(store.getState().document);
    expect(store.getState().setPoints(childId, 4).ok).toBe(true);

    const snapshot = captureSyncRollbackSnapshot({
      capturedAt: '2026-04-09T21:00:00.000Z',
      document: store.getState().document,
    });

    expect(snapshot).toEqual({
      capturedAt: '2026-04-09T21:00:00.000Z',
      document: cloneSharedDocument(store.getState().document),
      projectionHeadHash: deriveSyncProjection(store.getState().document)
        .headHash,
      projectionHeadSyncHash: deriveSyncProjection(store.getState().document)
        .headSyncHash,
    });
  });
});
