import {
  cloneSharedDocument,
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

  it('creates, updates, and reorders shop items while recording transaction metadata', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-shop-catalog',
      }),
      storage: createMemoryStorage(),
    });

    expect(
      store.getState().createShopSku({
        image: createShopImage({ base64: 'robot' }),
        name: ' Robot Toy ',
        pointCost: 12,
      }).ok,
    ).toBe(true);
    expect(
      store.getState().createShopSku({
        image: createShopImage({ base64: 'book' }),
        name: 'Book',
        pointCost: 5,
      }).ok,
    ).toBe(true);

    const [firstSkuId, secondSkuId] =
      store.getState().document.head.shop.skuOrder;

    if (!firstSkuId || !secondSkuId) {
      throw new Error('Expected two shop items in the catalog.');
    }

    expect(
      store.getState().updateShopSku(firstSkuId, {
        image: createShopImage({
          base64: 'robot-updated',
          height: 600,
          width: 800,
        }),
        name: 'Robot Toy Deluxe',
        pointCost: 15,
      }).ok,
    ).toBe(true);
    expect(store.getState().reorderShopSkus([secondSkuId, firstSkuId]).ok).toBe(
      true,
    );

    const document = store.getState().document;
    const rows = deriveTransactionRows(document);

    expect(document.head.shop.skuOrder).toEqual([secondSkuId, firstSkuId]);
    expect(document.head.shop.skusById[firstSkuId]).toMatchObject({
      id: firstSkuId,
      image: createShopImage({
        base64: 'robot-updated',
        height: 600,
        width: 800,
      }),
      name: 'Robot Toy Deluxe',
      pointCost: 15,
    });
    expect(
      document.transactions.slice(-4).map((transaction) => transaction.kind),
    ).toEqual([
      'shop-sku-created',
      'shop-sku-created',
      'shop-sku-updated',
      'shop-sku-reordered',
    ]);
    expect(document.transactions.at(-2)).toMatchObject({
      kind: 'shop-sku-updated',
      shopSkuId: firstSkuId,
      shopSkuName: 'Robot Toy Deluxe',
    });
    expect(rows[0]?.summaryText).toBe('Reordered Shop Items');
    expect(rows[1]?.summaryText).toBe('Robot Toy Deluxe Updated');
    expect(rows[2]?.summaryText).toBe('Book Added To Shop');
    expect(rows[3]?.summaryText).toBe('Robot Toy Added To Shop');
  });

  it('completes a shop purchase, deducts points, and stores itemized history', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-shop-purchase',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];

    if (!childId) {
      throw new Error('Expected a child before purchasing from the shop.');
    }

    expect(store.getState().setPoints(childId, 20).ok).toBe(true);
    expect(
      store.getState().createShopSku({
        image: createShopImage({ base64: 'slime' }),
        name: 'Slime',
        pointCost: 4,
      }).ok,
    ).toBe(true);
    expect(
      store.getState().createShopSku({
        image: createShopImage({ base64: 'stickers' }),
        name: 'Sticker Pack',
        pointCost: 3,
      }).ok,
    ).toBe(true);

    const [slimeSkuId, stickerSkuId] =
      store.getState().document.head.shop.skuOrder;

    if (!slimeSkuId || !stickerSkuId) {
      throw new Error('Expected two SKUs before checkout.');
    }

    expect(
      store.getState().completeShopPurchase(childId, [
        { quantity: 2, skuId: slimeSkuId },
        { quantity: 1, skuId: stickerSkuId },
      ]).ok,
    ).toBe(true);

    const document = store.getState().document;
    const purchaseTransaction = document.transactions.at(-1);
    const rows = deriveTransactionRows(document);

    expect(document.head.childrenById[childId]?.points).toBe(9);
    expect(purchaseTransaction).toMatchObject({
      childId,
      childName: 'Ava',
      kind: 'shop-purchase-completed',
      pointsAfter: 9,
      pointsBefore: 20,
      shopPurchaseTotalCost: 11,
    });
    expect(purchaseTransaction?.shopPurchaseItems).toEqual([
      {
        lineTotal: 8,
        pointCost: 4,
        quantity: 2,
        skuId: slimeSkuId,
        skuName: 'Slime',
      },
      {
        lineTotal: 3,
        pointCost: 3,
        quantity: 1,
        skuId: stickerSkuId,
        skuName: 'Sticker Pack',
      },
    ]);
    expect(rows[0]?.summaryText).toBe('Ava Purchased 3 Items [20 > 9]');
  });

  it('restores shop catalog state and child points when rewinding before a purchase', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-shop-restore',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];

    if (!childId) {
      throw new Error('Expected a child in the shop restore test.');
    }

    expect(store.getState().setPoints(childId, 10).ok).toBe(true);
    expect(
      store.getState().createShopSku({
        image: createShopImage({ base64: 'ball' }),
        name: 'Ball',
        pointCost: 3,
      }).ok,
    ).toBe(true);
    expect(
      store.getState().createShopSku({
        image: createShopImage({ base64: 'kite' }),
        name: 'Kite',
        pointCost: 4,
      }).ok,
    ).toBe(true);

    const [ballSkuId, kiteSkuId] = store.getState().document.head.shop.skuOrder;

    if (!ballSkuId || !kiteSkuId) {
      throw new Error('Expected two SKUs in the shop restore test.');
    }

    const targetTransactionId =
      store.getState().document.transactions.at(-1)?.id ?? null;

    expect(
      store
        .getState()
        .completeShopPurchase(childId, [{ quantity: 1, skuId: ballSkuId }]).ok,
    ).toBe(true);
    expect(store.getState().reorderShopSkus([kiteSkuId, ballSkuId]).ok).toBe(
      true,
    );
    expect(
      store.getState().restoreTransaction(targetTransactionId ?? '').ok,
    ).toBe(true);

    const document = store.getState().document;
    const rows = deriveTransactionRows(document);

    expect(document.head.childrenById[childId]?.points).toBe(10);
    expect(document.head.shop.skuOrder).toEqual([ballSkuId, kiteSkuId]);
    expect(rows[0]?.summaryText).toBe('Restored App to Kite Added To Shop');
  });

  it('rejects invalid shop purchases without changing the ledger head', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-shop-rejections',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);
    const childId = store.getState().document.head.activeChildIds[0];

    if (!childId) {
      throw new Error('Expected a child in the shop rejection test.');
    }

    expect(store.getState().setPoints(childId, 2).ok).toBe(true);
    expect(
      store.getState().createShopSku({
        image: createShopImage({ base64: 'lego' }),
        name: 'LEGO Minifig',
        pointCost: 5,
      }).ok,
    ).toBe(true);

    const skuId = store.getState().document.head.shop.skuOrder[0];

    if (!skuId) {
      throw new Error('Expected one SKU in the shop rejection test.');
    }

    const headTransactionId =
      store.getState().document.currentHeadTransactionId;
    const transactionCount = store.getState().document.transactions.length;

    expect(store.getState().completeShopPurchase(childId, []).ok).toBe(false);
    expect(
      store
        .getState()
        .completeShopPurchase(childId, [{ quantity: 1, skuId: 'missing-sku' }]),
    ).toEqual({
      error: 'One of the cart items no longer exists in the shop.',
      ok: false,
    });
    expect(
      store.getState().completeShopPurchase(childId, [{ quantity: 1, skuId }]),
    ).toEqual({
      error: 'That child does not have enough points for this cart.',
      ok: false,
    });
    expect(store.getState().document.currentHeadTransactionId).toBe(
      headTransactionId,
    );
    expect(store.getState().document.transactions).toHaveLength(
      transactionCount,
    );
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

  it('imports bootstrap source history into an empty device and keeps the sync audit row read-only', () => {
    const sourceStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-store-bootstrap-source',
      }),
      storage: createMemoryStorage(),
    });
    const targetStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-store-bootstrap-target',
      }),
      storage: createMemoryStorage(),
    });

    expect(sourceStore.getState().addChild('Ava').ok).toBe(true);
    const childId = sourceStore.getState().document.head.activeChildIds[0];

    if (!childId) {
      throw new Error('Expected bootstrap source fixture to create a child.');
    }

    expect(sourceStore.getState().setPoints(childId, 5).ok).toBe(true);

    const sourceProjection = deriveSyncProjection(
      sourceStore.getState().document,
    );
    const preparedBundle = prepareSyncDeviceBundle({
      capturedAt: '2026-04-09T22:07:00.000Z',
      localDocument: targetStore.getState().document,
      remoteProjection: sourceProjection,
    });

    if (!preparedBundle.ok) {
      throw new Error('Expected bootstrap sync bundle preparation to succeed.');
    }

    expect(
      targetStore
        .getState()
        .applySyncBundle(
          preparedBundle.sharedBundle,
          preparedBundle.localRollbackSnapshot,
        ).ok,
    ).toBe(true);

    const document = targetStore.getState().document;
    const rows = deriveTransactionRows(document);
    const importedHeadId = sourceProjection.entries.at(-1)?.sourceTransactionId;
    const importedHeadRow = rows.find((row) => row.id === importedHeadId);
    const syncAuditRow = rows.find((row) => row.kind === 'sync-applied');

    expect(document.events).toEqual([]);
    expect(document.head.childrenById[childId]?.points).toBe(5);
    expect(document.currentHeadTransactionId).toBe(importedHeadId);
    expect(
      document.transactions.slice(0, -1).map((transaction) => transaction.id),
    ).toEqual(
      sourceProjection.entries.map((entry) => entry.sourceTransactionId),
    );
    expect(
      document.transactions
        .slice(0, -1)
        .every((transaction) => transaction.eventIds.length === 0),
    ).toBe(true);
    expect(document.transactions.at(-1)).toMatchObject({
      isRestorable: false,
      kind: 'sync-applied',
      participatesInHistory: false,
    });
    expect(importedHeadRow).toMatchObject({
      isHead: true,
      summaryText: 'Ava Set Points [0 > 5]',
    });
    expect(syncAuditRow).toMatchObject({
      isHead: false,
      isRestorable: false,
      summaryText: 'Applied Device Sync',
    });
    expect(document.syncState?.lastAppliedSync).toMatchObject({
      bundleHash: preparedBundle.sharedBundle.bundleHash,
      mode: 'bootstrap',
    });
  });

  it('keeps the populated bootstrap side unchanged except for a read-only sync audit row', () => {
    const populatedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-store-bootstrap-populated',
      }),
      storage: createMemoryStorage(),
    });
    const emptyProjection = deriveSyncProjection(
      createInitialSharedDocument({
        deviceId: 'device-sync-store-bootstrap-empty',
      }),
    );

    expect(populatedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = populatedStore.getState().document.head.activeChildIds[0];

    if (!childId) {
      throw new Error(
        'Expected populated bootstrap fixture to create a child.',
      );
    }

    expect(populatedStore.getState().setPoints(childId, 5).ok).toBe(true);

    const previousDocument = cloneSharedDocument(
      populatedStore.getState().document,
    );
    const previousHeadTransactionId = previousDocument.currentHeadTransactionId;
    const preparedBundle = prepareSyncDeviceBundle({
      capturedAt: '2026-04-09T22:08:00.000Z',
      localDocument: populatedStore.getState().document,
      remoteProjection: emptyProjection,
    });

    if (!preparedBundle.ok) {
      throw new Error(
        'Expected populated bootstrap bundle preparation to succeed.',
      );
    }

    expect(
      populatedStore
        .getState()
        .applySyncBundle(
          preparedBundle.sharedBundle,
          preparedBundle.localRollbackSnapshot,
        ).ok,
    ).toBe(true);

    const document = populatedStore.getState().document;
    const rows = deriveTransactionRows(document);
    const syncAuditRow = rows.find((row) => row.kind === 'sync-applied');
    const previousHeadRow = rows.find(
      (row) => row.id === previousHeadTransactionId,
    );

    expect(document.head).toEqual(previousDocument.head);
    expect(document.currentHeadTransactionId).toBe(previousHeadTransactionId);
    expect(document.transactions).toHaveLength(
      previousDocument.transactions.length + 1,
    );
    expect(document.transactions.at(-1)).toMatchObject({
      kind: 'sync-applied',
      participatesInHistory: false,
    });
    expect(previousHeadRow?.isHead).toBe(true);
    expect(syncAuditRow).toMatchObject({
      isHead: false,
      summaryText: 'Applied Device Sync',
    });
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

  it('reverts an imported bootstrap sync back to the empty rollback snapshot', () => {
    const sourceStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-store-bootstrap-revert-source',
      }),
      storage: createMemoryStorage(),
    });
    const targetStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-store-bootstrap-revert-target',
      }),
      storage: createMemoryStorage(),
    });

    expect(sourceStore.getState().addChild('Ava').ok).toBe(true);
    const childId = sourceStore.getState().document.head.activeChildIds[0];

    if (!childId) {
      throw new Error('Expected bootstrap revert fixture to create a child.');
    }

    expect(sourceStore.getState().setPoints(childId, 5).ok).toBe(true);

    const preparedBundle = prepareSyncDeviceBundle({
      capturedAt: '2026-04-09T22:09:00.000Z',
      localDocument: targetStore.getState().document,
      remoteProjection: deriveSyncProjection(sourceStore.getState().document),
    });

    if (!preparedBundle.ok) {
      throw new Error(
        'Expected bootstrap revert bundle preparation to succeed.',
      );
    }

    const rollbackDocument = preparedBundle.localRollbackSnapshot.document;

    expect(
      targetStore
        .getState()
        .applySyncBundle(
          preparedBundle.sharedBundle,
          preparedBundle.localRollbackSnapshot,
        ).ok,
    ).toBe(true);
    expect(targetStore.getState().revertLastSync().ok).toBe(true);
    expect(targetStore.getState().document).toEqual({
      ...rollbackDocument,
      syncState: null,
    });
  });

  it('treats reapplying the same sync bundle hash as an idempotent no-op', () => {
    const seedStore = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-store-idempotent-seed',
      }),
      storage: createMemoryStorage(),
    });

    expect(seedStore.getState().addChild('Ava').ok).toBe(true);
    const childId = seedStore.getState().document.head.activeChildIds[0];

    if (!childId) {
      throw new Error('Expected idempotent fixture to create a child.');
    }

    const leftStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-store-idempotent-left',
      ),
      storage: createMemoryStorage(),
    });
    const rightStore = createSharedStore({
      initialDocument: cloneDocumentForDevice(
        seedStore.getState().document,
        'device-sync-store-idempotent-right',
      ),
      storage: createMemoryStorage(),
    });

    expect(leftStore.getState().adjustPoints(childId, 2).ok).toBe(true);
    expect(rightStore.getState().adjustPoints(childId, 3).ok).toBe(true);

    const preparedBundle = prepareSyncDeviceBundle({
      capturedAt: '2026-04-09T22:20:00.000Z',
      localDocument: leftStore.getState().document,
      remoteProjection: deriveSyncProjection(rightStore.getState().document),
    });

    if (!preparedBundle.ok) {
      throw new Error('Expected idempotent bundle preparation to succeed.');
    }

    expect(
      leftStore
        .getState()
        .applySyncBundle(
          preparedBundle.sharedBundle,
          preparedBundle.localRollbackSnapshot,
        ).ok,
    ).toBe(true);

    const transactionCount = leftStore.getState().document.transactions.length;

    expect(
      leftStore
        .getState()
        .applySyncBundle(
          preparedBundle.sharedBundle,
          preparedBundle.localRollbackSnapshot,
        ).ok,
    ).toBe(true);
    expect(leftStore.getState().document.transactions).toHaveLength(
      transactionCount,
    );
    expect(
      leftStore.getState().document.syncState?.lastAppliedSync?.bundleHash,
    ).toBe(preparedBundle.sharedBundle.bundleHash);
  });
});
