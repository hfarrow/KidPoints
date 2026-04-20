import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { useStore } from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { createModuleLogger, createStructuredLog } from '../logging/logger';
import type { SyncBundle, SyncEntry, SyncRollbackSnapshot } from './sharedSync';
import { deriveSyncProjection } from './sharedSync';
import {
  areTimerConfigsEquivalent,
  areTimerStatesEquivalent,
  cloneTimerConfig,
  cloneTimerState,
  computeSharedTimerSnapshot,
  DEFAULT_TIMER_CONFIG,
  DEFAULT_TIMER_STATE,
  getTimerIntervalMs,
  normalizeTimerConfig,
  normalizeTimerState,
} from './sharedTimer';
import type {
  ChildSnapshot,
  SharedCommandResult,
  SharedDocument,
  SharedDocumentSnapshot,
  SharedEvent,
  SharedHead,
  SharedShopState,
  SharedSyncState,
  SharedTimerConfig,
  SharedTimerState,
  ShopPurchaseItemSnapshot,
  ShopSkuImageSnapshot,
  ShopSkuSnapshot,
  StoredSyncBundle,
  StoredSyncRollbackSnapshot,
  TransactionFilterChild,
  TransactionKind,
  TransactionRecord,
  TransactionRow,
} from './sharedTypes';
import { useStableStoreReference } from './useStableStoreReference';

type SharedStoreState = {
  addChild: (name: string) => SharedCommandResult;
  adjustPoints: (childId: string, delta: number) => SharedCommandResult;
  applySyncBundle: (
    bundle: SyncBundle,
    rollbackSnapshot: SyncRollbackSnapshot,
  ) => SharedCommandResult;
  archiveChild: (childId: string) => SharedCommandResult;
  completeShopPurchase: (
    childId: string,
    items: {
      quantity: number;
      skuId: string;
    }[],
  ) => SharedCommandResult;
  createShopSku: (input: {
    image: ShopSkuImageSnapshot;
    name: string;
    pointCost: number;
  }) => SharedCommandResult;
  deleteChildPermanently: (childId: string) => SharedCommandResult;
  document: SharedDocument;
  pauseTimer: () => SharedCommandResult;
  recordParentModeLocked: () => SharedCommandResult;
  recordParentUnlockAttempt: (success: boolean) => SharedCommandResult;
  resetTimer: () => SharedCommandResult;
  reorderShopSkus: (skuOrder: string[]) => SharedCommandResult;
  resolveCheckInSession: (
    childDecisions: {
      childId: string;
      status: 'awarded' | 'dismissed';
    }[],
  ) => SharedCommandResult;
  restoreChild: (childId: string) => SharedCommandResult;
  revertLastSync: () => SharedCommandResult;
  restoreTransaction: (transactionId: string) => SharedCommandResult;
  setPoints: (childId: string, points: number) => SharedCommandResult;
  startTimer: () => SharedCommandResult;
  updateShopSku: (
    skuId: string,
    updates: {
      image: ShopSkuImageSnapshot;
      name: string;
      pointCost: number;
    },
  ) => SharedCommandResult;
  updateTimerConfig: (
    updates: Partial<SharedTimerConfig>,
  ) => SharedCommandResult;
};

type SharedStore = StoreApi<SharedStoreState>;

const SHARED_STORAGE_KEY = 'kidpoints.shared-document.v2';
const SHARED_STORE_BUILD_TOKEN = Symbol('shared-store-build');
const log = createModuleLogger('shared-store');
const logCommittedSharedStoreMutation = createStructuredLog(
  log,
  'debug',
  'Shared store mutation committed',
);
const logRejectedSharedStoreMutationMessage = createStructuredLog(
  log,
  'error',
  'Shared store mutation rejected',
);
const logSharedTransactionCommitted = createStructuredLog(
  log,
  'info',
  'Shared transaction committed',
);
const logSkippedInvalidSharedStoreRehydrate = createStructuredLog(
  log,
  'debug',
  'Shared store rehydrate skipped invalid persisted state',
);
const logSharedStoreRehydrated = createStructuredLog(
  log,
  'info',
  'Shared store rehydrated persisted document',
);
const TRANSIENT_TIMER_TRANSACTION_KINDS = new Set<TransactionKind>([
  'timer-paused',
  'timer-reset',
  'timer-started',
]);

const SharedStoreContext = createContext<SharedStore | null>(null);

type SharedStoreProviderProps = PropsWithChildren<{
  initialDocument?: SharedDocument;
  storage?: StateStorage;
}>;

function logSharedStoreMutation(
  action: string,
  details: Record<string, unknown> = {},
) {
  logCommittedSharedStoreMutation({
    action,
    ...details,
  });
}

function logRejectedSharedStoreMutation(
  action: string,
  error: string,
  details: Record<string, unknown> = {},
) {
  logRejectedSharedStoreMutationMessage({
    action,
    error,
    ...details,
  });
}

function logSharedTransaction(
  transaction: TransactionRecord,
  details: Record<string, unknown> = {},
) {
  logSharedTransactionCommitted({
    affectedChildIds: transaction.affectedChildIds,
    childId: transaction.childId,
    isRestorable: transaction.isRestorable,
    kind: transaction.kind,
    parentTransactionId: transaction.parentTransactionId,
    participatesInHistory: transaction.participatesInHistory,
    pointsAfter: transaction.pointsAfter ?? null,
    pointsBefore: transaction.pointsBefore ?? null,
    restoredFromTransactionId: transaction.restoredFromTransactionId ?? null,
    restoredToTransactionId: transaction.restoredToTransactionId ?? null,
    transactionId: transaction.id,
    ...details,
  });
}

/**
 * Creates the canonical empty HEAD snapshot so every new or recovered document
 * starts from the same baseline state shape.
 */
function createEmptyHead(): SharedHead {
  return {
    activeChildIds: [],
    archivedChildIds: [],
    childrenById: {},
    shop: {
      skuOrder: [],
      skusById: {},
    },
    timerConfig: cloneTimerConfig(DEFAULT_TIMER_CONFIG),
    timerState: cloneTimerState(DEFAULT_TIMER_STATE),
  };
}

function generateId(prefix: string) {
  const randomPart = Math.random().toString(36).slice(2, 10);

  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

function cloneChildSnapshot(child: ChildSnapshot): ChildSnapshot {
  return { ...child };
}

function cloneShopSkuImageSnapshot(
  image: ShopSkuImageSnapshot,
): ShopSkuImageSnapshot {
  return { ...image };
}

function cloneShopSkuSnapshot(sku: ShopSkuSnapshot): ShopSkuSnapshot {
  return {
    ...sku,
    image: cloneShopSkuImageSnapshot(sku.image),
  };
}

function cloneShopPurchaseItemSnapshot(
  item: ShopPurchaseItemSnapshot,
): ShopPurchaseItemSnapshot {
  return { ...item };
}

function cloneSharedShopState(shop: SharedShopState): SharedShopState {
  return {
    skuOrder: [...shop.skuOrder],
    skusById: Object.fromEntries(
      Object.entries(shop.skusById).map(([skuId, sku]) => [
        skuId,
        cloneShopSkuSnapshot(sku),
      ]),
    ),
  };
}

/**
 * Produces a deep-enough clone of the current shared HEAD so history snapshots
 * stay immutable once they are recorded.
 */
function cloneHead(head: SharedHead): SharedHead {
  return {
    activeChildIds: [...head.activeChildIds],
    archivedChildIds: [...head.archivedChildIds],
    childrenById: Object.fromEntries(
      Object.entries(head.childrenById).map(([id, child]) => [
        id,
        cloneChildSnapshot(child),
      ]),
    ),
    shop: cloneSharedShopState(head.shop),
    timerConfig: cloneTimerConfig(head.timerConfig),
    timerState: cloneTimerState(head.timerState),
  };
}

function normalizeHead(
  head: Partial<SharedHead> | null | undefined,
): SharedHead {
  return {
    activeChildIds: Array.isArray(head?.activeChildIds)
      ? [...head.activeChildIds]
      : [],
    archivedChildIds: Array.isArray(head?.archivedChildIds)
      ? [...head.archivedChildIds]
      : [],
    childrenById:
      head?.childrenById && typeof head.childrenById === 'object'
        ? Object.fromEntries(
            Object.entries(head.childrenById).map(([id, child]) => [
              id,
              cloneChildSnapshot(child as ChildSnapshot),
            ]),
          )
        : {},
    shop:
      head?.shop && typeof head.shop === 'object'
        ? {
            skuOrder: Array.isArray(head.shop.skuOrder)
              ? [...head.shop.skuOrder]
              : [],
            skusById:
              head.shop.skusById && typeof head.shop.skusById === 'object'
                ? Object.fromEntries(
                    Object.entries(head.shop.skusById).map(([skuId, sku]) => [
                      skuId,
                      cloneShopSkuSnapshot(sku as ShopSkuSnapshot),
                    ]),
                  )
                : {},
          }
        : {
            skuOrder: [],
            skusById: {},
          },
    timerConfig: normalizeTimerConfig(head?.timerConfig),
    timerState: normalizeTimerState(head?.timerState),
  };
}

function cloneHeadWithTimerState(
  head: SharedHead,
  timerState: SharedTimerState,
) {
  return {
    ...cloneHead(head),
    timerState: cloneTimerState(timerState),
  } satisfies SharedHead;
}

function cloneStoredSyncBundle(
  bundle: StoredSyncBundle | null | undefined,
): StoredSyncBundle | null {
  if (!bundle) {
    return null;
  }

  return {
    ...bundle,
    childReconciliations: bundle.childReconciliations.map(
      (childReconciliation) => ({
        ...childReconciliation,
      }),
    ),
    participantHeadHashes: [...bundle.participantHeadHashes],
    participantHeadSyncHashes: [...bundle.participantHeadSyncHashes],
  };
}

function cloneSharedEventRecord(event: SharedEvent): SharedEvent {
  switch (event.type) {
    case 'child.archived':
    case 'child.deleted':
    case 'child.restored':
      return {
        ...event,
        payload: {
          childId: event.payload.childId,
        },
      };
    case 'child.created':
      return {
        ...event,
        payload: {
          child: cloneChildSnapshot(event.payload.child),
        },
      };
    case 'shop.skuCreated':
    case 'shop.skuUpdated':
      return {
        ...event,
        payload: {
          sku: cloneShopSkuSnapshot(event.payload.sku),
        },
      };
    case 'shop.skuDeleted':
      return {
        ...event,
        payload: {
          skuId: event.payload.skuId,
        },
      };
    case 'shop.skuOrderUpdated':
      return {
        ...event,
        payload: {
          skuOrder: [...event.payload.skuOrder],
        },
      };
    case 'shop.purchaseCompleted':
      return {
        ...event,
        payload: {
          childId: event.payload.childId,
          items: event.payload.items.map(cloneShopPurchaseItemSnapshot),
          totalPointCost: event.payload.totalPointCost,
        },
      };
    case 'child.pointsAdjusted':
      return {
        ...event,
        payload: {
          childId: event.payload.childId,
          delta: event.payload.delta,
        },
      };
    case 'child.pointsSet':
      return {
        ...event,
        payload: {
          childId: event.payload.childId,
          points: event.payload.points,
        },
      };
    case 'timer.configUpdated':
      return {
        ...event,
        payload: {
          timerConfig: cloneTimerConfig(event.payload.timerConfig),
        },
      };
    case 'timer.stateUpdated':
      return {
        ...event,
        payload: {
          timerState: cloneTimerState(event.payload.timerState),
        },
      };
  }
}

function cloneDocumentSnapshot(
  snapshot: SharedDocumentSnapshot | null | undefined,
): SharedDocumentSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return {
    currentHeadTransactionId: snapshot.currentHeadTransactionId,
    deviceId: snapshot.deviceId,
    events: snapshot.events.map(cloneSharedEventRecord),
    head: cloneHead(snapshot.head),
    isOrphanedRestoreWindowOpen: Boolean(snapshot.isOrphanedRestoreWindowOpen),
    nextSequence: snapshot.nextSequence,
    schemaVersion: snapshot.schemaVersion,
    transactions: snapshot.transactions.map((transaction) =>
      normalizeTransactionRecord(snapshot.deviceId, transaction),
    ),
  };
}

function cloneStoredSyncRollbackSnapshot(
  snapshot: StoredSyncRollbackSnapshot | null | undefined,
): StoredSyncRollbackSnapshot | null {
  if (!snapshot) {
    return null;
  }

  const documentSnapshot = cloneDocumentSnapshot(snapshot.documentSnapshot);

  if (!documentSnapshot) {
    return null;
  }

  return {
    capturedAt: snapshot.capturedAt,
    documentSnapshot,
    projectionHeadHash: snapshot.projectionHeadHash,
    projectionHeadSyncHash: snapshot.projectionHeadSyncHash,
  };
}

function cloneSharedSyncState(
  syncState: SharedSyncState | null | undefined,
): SharedSyncState | null {
  if (!syncState) {
    return null;
  }

  return {
    lastAppliedSync: cloneStoredSyncBundle(syncState.lastAppliedSync),
    lastRollbackSnapshot: cloneStoredSyncRollbackSnapshot(
      syncState.lastRollbackSnapshot,
    ),
  };
}

/**
 * Keeps restored and user-entered names consistent so transaction summaries and
 * list rendering do not drift because of whitespace differences.
 */
function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function insertUniqueId(ids: string[], id: string) {
  return ids.includes(id) ? ids : [...ids, id];
}

function removeId(ids: string[], id: string) {
  return ids.filter((value) => value !== id);
}

function getChild(head: SharedHead, childId: string) {
  return head.childrenById[childId] ?? null;
}

function areChildrenEquivalent(
  left: ChildSnapshot | null,
  right: ChildSnapshot | null,
) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.archivedAt === right.archivedAt &&
    left.createdAt === right.createdAt &&
    left.id === right.id &&
    left.name === right.name &&
    left.points === right.points &&
    left.status === right.status &&
    left.updatedAt === right.updatedAt
  );
}

function areShopSkuImagesEquivalent(
  left: ShopSkuImageSnapshot | null,
  right: ShopSkuImageSnapshot | null,
) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.aspectRatio === right.aspectRatio &&
    left.base64 === right.base64 &&
    left.height === right.height &&
    left.mimeType === right.mimeType &&
    left.width === right.width
  );
}

function areShopSkusEquivalent(
  left: ShopSkuSnapshot | null,
  right: ShopSkuSnapshot | null,
) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.createdAt === right.createdAt &&
    left.id === right.id &&
    areShopSkuImagesEquivalent(left.image, right.image) &&
    left.name === right.name &&
    left.pointCost === right.pointCost &&
    left.updatedAt === right.updatedAt
  );
}

function sortEventsCanonical(events: SharedEvent[]) {
  return [...events].sort((left, right) => {
    if (left.deviceId !== right.deviceId) {
      return left.deviceId.localeCompare(right.deviceId);
    }

    return left.sequence - right.sequence;
  });
}

/**
 * Builds the persisted shared document shell used for first launch, tests, and
 * any recovery path that needs a safe starting point.
 */
export function createInitialSharedDocument({
  deviceId = generateId('device'),
}: {
  deviceId?: string;
} = {}): SharedDocument {
  return {
    currentHeadTransactionId: null,
    deviceId,
    events: [],
    head: createEmptyHead(),
    isOrphanedRestoreWindowOpen: false,
    nextSequence: 1,
    schemaVersion: 6,
    syncState: null,
    transactions: [],
  };
}

/**
 * Replays one domain event into a new HEAD snapshot so the store can derive
 * current state from append-only event history without mutating old snapshots.
 */
export function applySharedEvent(head: SharedHead, event: SharedEvent) {
  const nextHead = cloneHead(head);

  switch (event.type) {
    case 'child.created': {
      const child = cloneChildSnapshot(event.payload.child);

      nextHead.childrenById[child.id] = child;
      if (child.status === 'archived') {
        nextHead.archivedChildIds = insertUniqueId(
          nextHead.archivedChildIds,
          child.id,
        );
        nextHead.activeChildIds = removeId(nextHead.activeChildIds, child.id);
      } else {
        nextHead.activeChildIds = insertUniqueId(
          nextHead.activeChildIds,
          child.id,
        );
        nextHead.archivedChildIds = removeId(
          nextHead.archivedChildIds,
          child.id,
        );
      }
      return nextHead;
    }
    case 'child.pointsAdjusted': {
      const child = nextHead.childrenById[event.payload.childId];

      if (!child) {
        return nextHead;
      }

      nextHead.childrenById[event.payload.childId] = {
        ...child,
        points: child.points + event.payload.delta,
        updatedAt: event.occurredAt,
      };
      return nextHead;
    }
    case 'child.pointsSet': {
      const child = nextHead.childrenById[event.payload.childId];

      if (!child) {
        return nextHead;
      }

      nextHead.childrenById[event.payload.childId] = {
        ...child,
        points: event.payload.points,
        updatedAt: event.occurredAt,
      };
      return nextHead;
    }
    case 'child.archived': {
      const child = nextHead.childrenById[event.payload.childId];

      if (!child) {
        return nextHead;
      }

      nextHead.childrenById[event.payload.childId] = {
        ...child,
        archivedAt: event.occurredAt,
        status: 'archived',
        updatedAt: event.occurredAt,
      };
      nextHead.activeChildIds = removeId(nextHead.activeChildIds, child.id);
      nextHead.archivedChildIds = insertUniqueId(
        nextHead.archivedChildIds,
        child.id,
      );
      return nextHead;
    }
    case 'child.restored': {
      const child = nextHead.childrenById[event.payload.childId];

      if (!child) {
        return nextHead;
      }

      nextHead.childrenById[event.payload.childId] = {
        ...child,
        archivedAt: undefined,
        status: 'active',
        updatedAt: event.occurredAt,
      };
      nextHead.archivedChildIds = removeId(nextHead.archivedChildIds, child.id);
      nextHead.activeChildIds = insertUniqueId(
        nextHead.activeChildIds,
        child.id,
      );
      return nextHead;
    }
    case 'child.deleted': {
      const child = nextHead.childrenById[event.payload.childId];

      if (!child) {
        return nextHead;
      }

      delete nextHead.childrenById[event.payload.childId];
      nextHead.activeChildIds = removeId(nextHead.activeChildIds, child.id);
      nextHead.archivedChildIds = removeId(nextHead.archivedChildIds, child.id);
      return nextHead;
    }
    case 'shop.skuCreated': {
      const sku = cloneShopSkuSnapshot(event.payload.sku);

      nextHead.shop.skusById[sku.id] = sku;
      nextHead.shop.skuOrder = insertUniqueId(nextHead.shop.skuOrder, sku.id);
      return nextHead;
    }
    case 'shop.skuUpdated': {
      const sku = cloneShopSkuSnapshot(event.payload.sku);

      nextHead.shop.skusById[sku.id] = sku;
      nextHead.shop.skuOrder = insertUniqueId(nextHead.shop.skuOrder, sku.id);
      return nextHead;
    }
    case 'shop.skuDeleted': {
      delete nextHead.shop.skusById[event.payload.skuId];
      nextHead.shop.skuOrder = removeId(
        nextHead.shop.skuOrder,
        event.payload.skuId,
      );
      return nextHead;
    }
    case 'shop.skuOrderUpdated': {
      const orderedIds = event.payload.skuOrder.filter(
        (skuId, index, values) =>
          values.indexOf(skuId) === index && nextHead.shop.skusById[skuId],
      );
      const remainingIds = Object.keys(nextHead.shop.skusById).filter(
        (skuId) => !orderedIds.includes(skuId),
      );

      nextHead.shop.skuOrder = [...orderedIds, ...remainingIds];
      return nextHead;
    }
    case 'shop.purchaseCompleted': {
      const child = nextHead.childrenById[event.payload.childId];

      if (!child) {
        return nextHead;
      }

      nextHead.childrenById[event.payload.childId] = {
        ...child,
        points: child.points - event.payload.totalPointCost,
        updatedAt: event.occurredAt,
      };
      return nextHead;
    }
    case 'timer.configUpdated': {
      nextHead.timerConfig = cloneTimerConfig(event.payload.timerConfig);
      return nextHead;
    }
    case 'timer.stateUpdated': {
      nextHead.timerState = cloneTimerState(event.payload.timerState);
      return nextHead;
    }
  }
}

/**
 * Resolves which transaction should define the active HEAD after rehydrate.
 * This keeps display-only audit rows from accidentally becoming the source of
 * truth for restorable app state.
 */
function getHeadForCurrentTransaction(
  transactions: TransactionRecord[],
  currentHeadTransactionId: string | null,
) {
  if (transactions.length === 0) {
    return createEmptyHead();
  }

  const headTransaction =
    transactions.find(
      (transaction) => transaction.id === currentHeadTransactionId,
    ) ?? findLatestHistoryTransaction(transactions);

  return headTransaction
    ? cloneHead(headTransaction.stateAfter)
    : createEmptyHead();
}

/**
 * Backfills persisted transactions into the current in-memory shape so older
 * documents continue to work after transaction metadata grows new fields.
 */
function normalizeTransactionRecord(
  documentDeviceId: string,
  transaction: TransactionRecord,
): TransactionRecord {
  const isTransientTimerTransaction = TRANSIENT_TIMER_TRANSACTION_KINDS.has(
    transaction.kind,
  );

  return {
    ...transaction,
    affectedChildIds: [...transaction.affectedChildIds],
    eventIds: [...transaction.eventIds],
    groupId: transaction.groupId,
    groupLabel: transaction.groupLabel,
    isRestorable: isTransientTimerTransaction
      ? false
      : (transaction.isRestorable ?? true),
    originDeviceId: transaction.originDeviceId ?? documentDeviceId,
    participatesInHistory: isTransientTimerTransaction
      ? false
      : (transaction.participatesInHistory ?? true),
    shopPurchaseItems: transaction.shopPurchaseItems?.map(
      cloneShopPurchaseItemSnapshot,
    ),
    shopPurchaseTotalCost: transaction.shopPurchaseTotalCost,
    shopSkuId: transaction.shopSkuId,
    shopSkuName: transaction.shopSkuName,
    stateAfter: normalizeHead(transaction.stateAfter),
  };
}

/**
 * Finds the newest transaction that still participates in restore history.
 * Audit-only rows are intentionally ignored here.
 */
function findLatestHistoryTransaction(transactions: TransactionRecord[]) {
  return [...transactions]
    .reverse()
    .find((transaction) => transaction.participatesInHistory);
}

function deriveNextSequence(events: SharedEvent[]) {
  const maxSequence = events.reduce(
    (currentMax, event) => Math.max(currentMax, event.sequence),
    0,
  );

  return maxSequence + 1;
}

function isSharedDocument(value: unknown): value is SharedDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Omit<Partial<SharedDocument>, 'schemaVersion'> & {
    schemaVersion?: number;
  };

  return (
    (candidate.schemaVersion === 2 ||
      candidate.schemaVersion === 3 ||
      candidate.schemaVersion === 4 ||
      candidate.schemaVersion === 5 ||
      candidate.schemaVersion === 6) &&
    typeof candidate.deviceId === 'string' &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.transactions)
  );
}

/**
 * Rebuilds a persisted document into the latest safe runtime shape, including
 * repairing the history head when older data or audit rows would otherwise
 * point at the wrong transaction.
 */
export function cloneSharedDocument(
  document: SharedDocument | null | undefined,
): SharedDocument {
  if (!document) {
    return createInitialSharedDocument();
  }

  const events = sortEventsCanonical(document.events);
  const transactions = document.transactions.map((transaction) =>
    normalizeTransactionRecord(document.deviceId, transaction),
  );
  const fallbackHeadTransactionId =
    findLatestHistoryTransaction(transactions)?.id ?? null;
  const currentHeadTransactionId = transactions.some(
    (transaction) =>
      transaction.id === document.currentHeadTransactionId &&
      transaction.participatesInHistory,
  )
    ? document.currentHeadTransactionId
    : fallbackHeadTransactionId;
  const historyHead = getHeadForCurrentTransaction(
    transactions,
    currentHeadTransactionId,
  );
  const persistedHead = normalizeHead(document.head);

  return {
    currentHeadTransactionId,
    deviceId: document.deviceId,
    events,
    head: cloneHeadWithTimerState(historyHead, persistedHead.timerState),
    isOrphanedRestoreWindowOpen: Boolean(document.isOrphanedRestoreWindowOpen),
    nextSequence: document.nextSequence ?? deriveNextSequence(events),
    schemaVersion: 6,
    syncState: cloneSharedSyncState(document.syncState),
    transactions,
  };
}

/**
 * Creates an event builder that owns sequence assignment for a single commit so
 * multi-event transactions can stay internally consistent.
 */
function createEventBuilder(document: SharedDocument) {
  let nextSequence = document.nextSequence;

  return {
    build<T extends SharedEvent['type']>(
      type: T,
      payload: Extract<SharedEvent, { type: T }>['payload'],
      occurredAt = new Date().toISOString(),
    ) {
      const event: Extract<SharedEvent, { type: T }> = {
        deviceId: document.deviceId,
        eventId: `${document.deviceId}-${nextSequence}`,
        occurredAt,
        payload,
        sequence: nextSequence,
        type,
      } as Extract<SharedEvent, { type: T }>;

      nextSequence += 1;
      return event;
    },
  };
}

/**
 * Shapes a transaction record from command metadata and snapshots so every
 * entry in the log carries the fields needed for summaries, restore rules, and
 * audit display.
 */
function createTransactionRecord(args: {
  affectedChildIds: string[];
  childAfter: ChildSnapshot | null;
  childBefore: ChildSnapshot | null;
  childId: string | null;
  eventIds: string[];
  groupId?: string;
  groupLabel?: string;
  isRestorable?: boolean;
  kind: TransactionKind;
  occurredAt: string;
  originDeviceId: string;
  parentTransactionId: string | null;
  participatesInHistory?: boolean;
  pointsAfter?: number;
  pointsBefore?: number;
  restoredFromTransactionId?: string;
  restoredToTransactionId?: string;
  shopPurchaseItems?: ShopPurchaseItemSnapshot[];
  shopPurchaseTotalCost?: number;
  shopSkuId?: string;
  shopSkuName?: string;
  stateAfter: SharedHead;
  transactionId?: string;
}) {
  const {
    affectedChildIds,
    childAfter,
    childBefore,
    childId,
    eventIds,
    groupId,
    groupLabel,
    isRestorable = true,
    kind,
    occurredAt,
    originDeviceId,
    parentTransactionId,
    participatesInHistory = true,
    pointsAfter,
    pointsBefore,
    restoredFromTransactionId,
    restoredToTransactionId,
    shopPurchaseItems,
    shopPurchaseTotalCost,
    shopSkuId,
    shopSkuName,
    stateAfter,
    transactionId,
  } = args;

  return {
    affectedChildIds,
    childId,
    childName: childAfter?.name ?? childBefore?.name ?? null,
    eventIds,
    groupId,
    groupLabel,
    id: transactionId ?? `tx-${eventIds[0] ?? generateId('transaction')}`,
    isRestorable,
    kind,
    occurredAt,
    originDeviceId,
    parentTransactionId,
    participatesInHistory,
    pointsAfter,
    pointsBefore,
    restoredFromTransactionId,
    restoredToTransactionId,
    shopPurchaseItems: shopPurchaseItems?.map(cloneShopPurchaseItemSnapshot),
    shopPurchaseTotalCost,
    shopSkuId,
    shopSkuName,
    stateAfter: cloneHead(stateAfter),
  } satisfies TransactionRecord;
}

function createTransactionRecordFromSyncEntry(args: {
  entry: SyncEntry;
  localHead: SharedHead;
  parentTransactionId: string | null;
}) {
  const { entry, localHead, parentTransactionId } = args;

  return {
    affectedChildIds: [...entry.affectedChildIds],
    childId: entry.childId,
    childName: entry.childName,
    eventIds: [],
    id: entry.sourceTransactionId,
    isRestorable: true,
    kind: entry.kind,
    occurredAt: entry.occurredAt,
    originDeviceId: entry.originDeviceId,
    parentTransactionId,
    participatesInHistory: true,
    pointsAfter: entry.pointsAfter ?? undefined,
    pointsBefore: entry.pointsBefore ?? undefined,
    restoredFromTransactionId: entry.restoredFromTransactionId ?? undefined,
    restoredToTransactionId: entry.restoredToTransactionId ?? undefined,
    shopPurchaseItems: entry.shopPurchaseItems?.map(
      cloneShopPurchaseItemSnapshot,
    ),
    shopPurchaseTotalCost: entry.shopPurchaseTotalCost ?? undefined,
    shopSkuId: entry.shopSkuId ?? undefined,
    shopSkuName: entry.shopSkuName ?? undefined,
    stateAfter: createSharedHeadFromSyncProjectionHead(
      entry.stateAfter,
      localHead,
    ),
  } satisfies TransactionRecord;
}

/**
 * Appends audit-style transactions that should appear in the log without
 * changing restore HEAD, event history, or branch state.
 */
function appendDisplayOnlyTransaction(args: {
  document: SharedDocument;
  transaction: TransactionRecord;
}) {
  const { document, transaction } = args;

  return {
    ...document,
    transactions: [...document.transactions, transaction],
  } satisfies SharedDocument;
}

/**
 * Applies a transient head change that should persist and be logged without
 * advancing restore history or altering orphaned-branch restore rules.
 */
function commitTransientHeadChange(args: {
  document: SharedDocument;
  nextHead: SharedHead;
  transaction: TransactionRecord;
  eventsToAppend?: SharedEvent[];
}) {
  const { document, eventsToAppend = [], nextHead, transaction } = args;
  const sortedEvents = sortEventsCanonical([
    ...document.events,
    ...eventsToAppend,
  ]);

  return {
    ...document,
    events: sortedEvents,
    head: cloneHead(nextHead),
    nextSequence: Math.max(
      document.nextSequence,
      deriveNextSequence(sortedEvents),
    ),
    transactions: [...document.transactions, transaction],
  } satisfies SharedDocument;
}

/**
 * Commits a history-driving transaction by advancing the active HEAD and
 * appending any new events produced by that command.
 */
function commitDocumentChange(args: {
  document: SharedDocument;
  isOrphanedRestoreWindowOpen: boolean;
  nextHead: SharedHead;
  transaction: TransactionRecord;
  eventsToAppend?: SharedEvent[];
}) {
  const {
    document,
    eventsToAppend = [],
    isOrphanedRestoreWindowOpen,
    nextHead,
    transaction,
  } = args;
  const sortedEvents = sortEventsCanonical([
    ...document.events,
    ...eventsToAppend,
  ]);

  return {
    ...document,
    currentHeadTransactionId: transaction.id,
    events: sortedEvents,
    head: cloneHead(nextHead),
    isOrphanedRestoreWindowOpen,
    nextSequence: Math.max(
      document.nextSequence,
      deriveNextSequence(sortedEvents),
    ),
    transactions: [...document.transactions, transaction],
  } satisfies SharedDocument;
}

function buildStoredSyncBundle(
  bundle: SyncBundle,
  appliedAt: string,
): StoredSyncBundle {
  return {
    appliedAt,
    bundleHash: bundle.bundleHash,
    childReconciliations: bundle.childReconciliations.map(
      (childReconciliation) => ({
        ...childReconciliation,
      }),
    ),
    commonBaseHash: bundle.commonBaseHash,
    mergedHeadSyncHash: bundle.mergedHeadSyncHash,
    mode: bundle.mode,
    participantHeadHashes: [...bundle.participantHeadHashes],
    participantHeadSyncHashes: [...bundle.participantHeadSyncHashes],
    syncSchemaVersion: bundle.syncSchemaVersion,
  };
}

function toStoredDocumentSnapshot(
  document: SharedDocument,
): SharedDocumentSnapshot {
  return {
    currentHeadTransactionId: document.currentHeadTransactionId,
    deviceId: document.deviceId,
    events: document.events.map(cloneSharedEventRecord),
    head: cloneHead(document.head),
    isOrphanedRestoreWindowOpen: document.isOrphanedRestoreWindowOpen,
    nextSequence: document.nextSequence,
    schemaVersion: document.schemaVersion,
    transactions: document.transactions.map((transaction) =>
      normalizeTransactionRecord(document.deviceId, transaction),
    ),
  };
}

function buildStoredSyncRollbackSnapshot(
  snapshot: SyncRollbackSnapshot,
): StoredSyncRollbackSnapshot {
  return {
    capturedAt: snapshot.capturedAt,
    documentSnapshot: toStoredDocumentSnapshot(snapshot.document),
    projectionHeadHash: snapshot.projectionHeadHash,
    projectionHeadSyncHash: snapshot.projectionHeadSyncHash,
  };
}

function createSharedHeadFromSyncProjectionHead(
  syncHead: SyncBundle['mergedHead'],
  localHead: SharedHead,
): SharedHead {
  return {
    activeChildIds: [...syncHead.activeChildIds],
    archivedChildIds: [...syncHead.archivedChildIds],
    childrenById: Object.fromEntries(
      Object.entries(syncHead.childrenById).map(([childId, child]) => [
        childId,
        {
          ...child,
          archivedAt: child.archivedAt ?? undefined,
        },
      ]),
    ),
    shop: {
      skuOrder: [...syncHead.shop.skuOrder],
      skusById: Object.fromEntries(
        Object.entries(syncHead.shop.skusById).map(([skuId, sku]) => [
          skuId,
          cloneShopSkuSnapshot(sku),
        ]),
      ),
    },
    timerConfig: cloneTimerConfig(localHead.timerConfig),
    timerState: cloneTimerState(localHead.timerState),
  };
}

function getTransactionMap(transactions: TransactionRecord[]) {
  return new Map(
    transactions.map((transaction) => [transaction.id, transaction] as const),
  );
}

/**
 * Walks backward from the current history head to identify the transactions
 * that still belong to the active branch. The Transactions screen uses this to
 * distinguish live history from orphaned branches.
 */
function getActiveTransactionIds(document: SharedDocument) {
  const transactionsById = getTransactionMap(document.transactions);
  const activeTransactionIds = new Set<string>();
  let currentId = document.currentHeadTransactionId;

  while (currentId) {
    if (activeTransactionIds.has(currentId)) {
      break;
    }

    activeTransactionIds.add(currentId);
    currentId = transactionsById.get(currentId)?.parentTransactionId ?? null;
  }

  return activeTransactionIds;
}

/**
 * Compares two HEAD snapshots as restore targets rather than as object
 * identities. This prevents no-op restores when the state is already at the
 * requested point in history.
 */
function areHeadsEquivalent(left: SharedHead, right: SharedHead) {
  const leftIds = Object.keys(left.childrenById).sort();
  const rightIds = Object.keys(right.childrenById).sort();
  const leftShopIds = Object.keys(left.shop.skusById).sort();
  const rightShopIds = Object.keys(right.shop.skusById).sort();

  if (
    leftIds.length !== rightIds.length ||
    leftShopIds.length !== rightShopIds.length ||
    left.activeChildIds.join('|') !== right.activeChildIds.join('|') ||
    left.archivedChildIds.join('|') !== right.archivedChildIds.join('|') ||
    left.shop.skuOrder.join('|') !== right.shop.skuOrder.join('|') ||
    !areTimerConfigsEquivalent(left.timerConfig, right.timerConfig) ||
    !areTimerStatesEquivalent(left.timerState, right.timerState)
  ) {
    return false;
  }

  return (
    leftIds.every((childId) =>
      areChildrenEquivalent(
        left.childrenById[childId],
        right.childrenById[childId],
      ),
    ) &&
    leftShopIds.every((skuId) =>
      areShopSkusEquivalent(
        left.shop.skusById[skuId],
        right.shop.skusById[skuId],
      ),
    )
  );
}

/**
 * Derives the timer state that represents "running now", preserving elapsed
 * progress when resuming from a paused snapshot.
 */
function buildStartedTimerState(
  timerConfig: SharedTimerConfig,
  timerState: SharedTimerState,
  now: number,
) {
  const snapshot = computeSharedTimerSnapshot(timerConfig, timerState, now);
  const activeIntervalMs =
    snapshot.status === 'paused'
      ? snapshot.intervalMs
      : getTimerIntervalMs(timerConfig);
  const elapsedBeforeStart =
    snapshot.status === 'paused' && snapshot.remainingMs > 0
      ? activeIntervalMs - snapshot.remainingMs
      : 0;

  return normalizeTimerState({
    activeIntervalMs,
    cycleStartedAt: now - elapsedBeforeStart,
    mode: 'running',
    pausedRemainingMs: null,
  });
}

/**
 * Captures a paused timer snapshot using the currently remaining duration so
 * the timer can resume from the same point later.
 */
function buildPausedTimerState(
  timerConfig: SharedTimerConfig,
  timerState: SharedTimerState,
  now: number,
) {
  const snapshot = computeSharedTimerSnapshot(timerConfig, timerState, now);

  return normalizeTimerState({
    activeIntervalMs: snapshot.intervalMs,
    cycleStartedAt: null,
    mode: 'paused',
    pausedRemainingMs: snapshot.remainingMs,
  });
}

/**
 * Centralizes the timer's canonical reset snapshot so reset actions and
 * rehydrate paths point at the same baseline.
 */
function buildResetTimerState() {
  return cloneTimerState(DEFAULT_TIMER_STATE);
}

/**
 * Reconstructs the event sequence needed to move the current HEAD to an older
 * transaction snapshot. Restore works by replaying forward into that target
 * state rather than mutating history in place.
 */
function buildRestoreEvents(
  document: SharedDocument,
  targetHead: SharedHead,
  occurredAt: string,
) {
  const builder = createEventBuilder(document);
  const eventsToAppend: SharedEvent[] = [];
  const affectedChildIds = new Set<string>();
  const allIds = [
    ...new Set([
      ...Object.keys(document.head.childrenById),
      ...Object.keys(targetHead.childrenById),
    ]),
  ].sort();

  for (const childId of allIds) {
    const currentChild = getChild(document.head, childId);
    const targetChild = getChild(targetHead, childId);

    if (areChildrenEquivalent(currentChild, targetChild)) {
      continue;
    }

    affectedChildIds.add(childId);

    if (!currentChild && targetChild) {
      eventsToAppend.push(
        builder.build(
          'child.created',
          {
            child: cloneChildSnapshot(targetChild),
          },
          occurredAt,
        ),
      );
      continue;
    }

    if (currentChild && !targetChild) {
      eventsToAppend.push(
        builder.build(
          'child.deleted',
          {
            childId,
          },
          occurredAt,
        ),
      );
      continue;
    }

    if (!currentChild || !targetChild) {
      continue;
    }

    if (currentChild.status !== targetChild.status) {
      eventsToAppend.push(
        targetChild.status === 'active'
          ? builder.build('child.restored', { childId }, occurredAt)
          : builder.build('child.archived', { childId }, occurredAt),
      );
    }

    if (currentChild.points !== targetChild.points) {
      eventsToAppend.push(
        builder.build(
          'child.pointsSet',
          {
            childId,
            points: targetChild.points,
          },
          occurredAt,
        ),
      );
    }
  }

  const allSkuIds = [
    ...new Set([
      ...Object.keys(document.head.shop.skusById),
      ...Object.keys(targetHead.shop.skusById),
    ]),
  ].sort();

  for (const skuId of allSkuIds) {
    const currentSku = document.head.shop.skusById[skuId] ?? null;
    const targetSku = targetHead.shop.skusById[skuId] ?? null;

    if (areShopSkusEquivalent(currentSku, targetSku)) {
      continue;
    }

    if (!currentSku && targetSku) {
      eventsToAppend.push(
        builder.build(
          'shop.skuCreated',
          {
            sku: cloneShopSkuSnapshot(targetSku),
          },
          occurredAt,
        ),
      );
      continue;
    }

    if (currentSku && !targetSku) {
      eventsToAppend.push(
        builder.build(
          'shop.skuDeleted',
          {
            skuId,
          },
          occurredAt,
        ),
      );
      continue;
    }

    if (targetSku) {
      eventsToAppend.push(
        builder.build(
          'shop.skuUpdated',
          {
            sku: cloneShopSkuSnapshot(targetSku),
          },
          occurredAt,
        ),
      );
    }
  }

  if (
    document.head.shop.skuOrder.join('|') !== targetHead.shop.skuOrder.join('|')
  ) {
    eventsToAppend.push(
      builder.build(
        'shop.skuOrderUpdated',
        {
          skuOrder: [...targetHead.shop.skuOrder],
        },
        occurredAt,
      ),
    );
  }

  if (
    !areTimerConfigsEquivalent(
      document.head.timerConfig,
      targetHead.timerConfig,
    )
  ) {
    eventsToAppend.push(
      builder.build(
        'timer.configUpdated',
        {
          timerConfig: cloneTimerConfig(targetHead.timerConfig),
        },
        occurredAt,
      ),
    );
  }

  if (
    !areTimerStatesEquivalent(document.head.timerState, targetHead.timerState)
  ) {
    eventsToAppend.push(
      builder.build(
        'timer.stateUpdated',
        {
          timerState: cloneTimerState(targetHead.timerState),
        },
        occurredAt,
      ),
    );
  }

  return {
    affectedChildIds: [...affectedChildIds],
    eventsToAppend,
  };
}

function formatTransactionTimestamp(occurredAt: string) {
  return new Date(occurredAt).toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

/**
 * Builds readable labels for restore targets so restore transactions can refer
 * back to the meaningful point in history they returned the app to.
 */
function summarizeRestoreTarget(
  targetTransaction: TransactionRecord | undefined,
  transactionsById: Map<string, TransactionRecord>,
): string {
  if (!targetTransaction) {
    return 'Earlier State';
  }

  switch (targetTransaction.kind) {
    case 'check-in-resolved': {
      const awardCount = targetTransaction.eventIds.length;

      if (
        awardCount === 1 &&
        targetTransaction.childName &&
        targetTransaction.pointsBefore != null &&
        targetTransaction.pointsAfter != null
      ) {
        return `${targetTransaction.childName} Check-In Award [${targetTransaction.pointsBefore} > ${targetTransaction.pointsAfter}]`;
      }

      if (awardCount > 0) {
        return `Check-In Awards +${awardCount} Point${awardCount === 1 ? '' : 's'}`;
      }

      return 'Resolved Check-In';
    }
    case 'check-in-dismissed':
      return targetTransaction.childName
        ? `${targetTransaction.childName} Check-In Dismissed`
        : 'Check-In Dismissed';
    case 'points-adjusted': {
      if (
        targetTransaction.childName &&
        targetTransaction.pointsBefore != null &&
        targetTransaction.pointsAfter != null
      ) {
        const delta =
          (targetTransaction.pointsAfter ?? 0) -
          (targetTransaction.pointsBefore ?? 0);
        const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;

        return `${targetTransaction.childName} ${deltaLabel} Points [${targetTransaction.pointsBefore} > ${targetTransaction.pointsAfter}]`;
      }

      return 'Point Change';
    }
    case 'points-set':
      if (
        targetTransaction.childName &&
        targetTransaction.pointsBefore != null &&
        targetTransaction.pointsAfter != null
      ) {
        return `${targetTransaction.childName} Set Points [${targetTransaction.pointsBefore} > ${targetTransaction.pointsAfter}]`;
      }

      return 'Point Total Update';
    case 'child-created':
      return targetTransaction.childName
        ? `${targetTransaction.childName} Added`
        : 'Child Added';
    case 'child-archived':
      return targetTransaction.childName
        ? `${targetTransaction.childName} Archived`
        : 'Child Archived';
    case 'child-restored':
      return targetTransaction.childName
        ? `${targetTransaction.childName} Unarchived`
        : 'Child Unarchived';
    case 'child-deleted':
      return targetTransaction.childName
        ? `${targetTransaction.childName} Deleted`
        : 'Child Deleted';
    case 'shop-sku-created':
      return targetTransaction.shopSkuName
        ? `${targetTransaction.shopSkuName} Added To Shop`
        : 'Shop Item Added';
    case 'shop-sku-updated':
      return targetTransaction.shopSkuName
        ? `${targetTransaction.shopSkuName} Updated`
        : 'Shop Item Updated';
    case 'shop-sku-reordered':
      return 'Reordered Shop Items';
    case 'shop-purchase-completed': {
      const itemCount =
        targetTransaction.shopPurchaseItems?.reduce(
          (currentTotal, item) => currentTotal + item.quantity,
          0,
        ) ?? 0;

      if (
        targetTransaction.childName &&
        itemCount > 0 &&
        targetTransaction.pointsBefore != null &&
        targetTransaction.pointsAfter != null
      ) {
        return `${targetTransaction.childName} Purchased ${itemCount} Item${itemCount === 1 ? '' : 's'} [${targetTransaction.pointsBefore} > ${targetTransaction.pointsAfter}]`;
      }

      return 'Completed Shop Purchase';
    }
    case 'history-restored': {
      const nestedTarget = targetTransaction.restoredToTransactionId
        ? transactionsById.get(targetTransaction.restoredToTransactionId)
        : undefined;

      return nestedTarget
        ? summarizeRestoreTarget(nestedTarget, transactionsById)
        : 'Earlier State';
    }
    case 'parent-mode-locked':
      return 'Parent Mode Locked';
    case 'parent-unlock-succeeded':
      return 'Parent PIN Unlock Succeeded';
    case 'parent-unlock-failed':
      return 'Parent PIN Unlock Failed';
    case 'timer-started':
      return 'Started Timer';
    case 'timer-paused':
      return 'Paused Timer';
    case 'timer-reset':
      return 'Reset Timer';
    case 'sync-applied':
      return 'Applied Device Sync';
    case 'timer-config-updated':
      return 'Updated Timer Settings';
  }
}

/**
 * Produces the user-facing summary for a single transaction row. This keeps the
 * screen copy aligned across direct actions, restores, and audit events.
 */
function summarizeTransactionRow(
  transaction: TransactionRecord,
  transactionsById: Map<string, TransactionRecord>,
) {
  switch (transaction.kind) {
    case 'check-in-resolved': {
      const awardCount = transaction.eventIds.length;

      if (
        awardCount === 1 &&
        transaction.childName &&
        transaction.pointsBefore != null &&
        transaction.pointsAfter != null
      ) {
        return `${transaction.childName} Check-In Award [${transaction.pointsBefore} > ${transaction.pointsAfter}]`;
      }

      if (awardCount > 0) {
        return `Check-In Awards +${awardCount} Point${awardCount === 1 ? '' : 's'}`;
      }

      return 'Resolved Check-In';
    }
    case 'check-in-dismissed':
      return transaction.childName
        ? `${transaction.childName} Check-In Dismissed`
        : 'Check-In Dismissed';
    case 'child-created':
      return transaction.childName
        ? `${transaction.childName} Added`
        : 'Child Added';
    case 'points-adjusted': {
      if (
        transaction.childName &&
        transaction.pointsBefore != null &&
        transaction.pointsAfter != null
      ) {
        const delta =
          (transaction.pointsAfter ?? 0) - (transaction.pointsBefore ?? 0);
        const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;

        return `${transaction.childName} ${deltaLabel} Points [${transaction.pointsBefore} > ${transaction.pointsAfter}]`;
      }

      return 'Point Change';
    }
    case 'points-set':
      if (
        transaction.childName &&
        transaction.pointsBefore != null &&
        transaction.pointsAfter != null
      ) {
        return `${transaction.childName} Set Points [${transaction.pointsBefore} > ${transaction.pointsAfter}]`;
      }

      return 'Point Total Update';
    case 'child-archived':
      return transaction.childName
        ? `${transaction.childName} Archived`
        : 'Child Archived';
    case 'child-restored':
      return transaction.childName
        ? `${transaction.childName} Unarchived`
        : 'Child Unarchived';
    case 'child-deleted':
      return transaction.childName
        ? `${transaction.childName} Deleted`
        : 'Child Deleted';
    case 'shop-sku-created':
      return transaction.shopSkuName
        ? `${transaction.shopSkuName} Added To Shop`
        : 'Shop Item Added';
    case 'shop-sku-updated':
      return transaction.shopSkuName
        ? `${transaction.shopSkuName} Updated`
        : 'Shop Item Updated';
    case 'shop-sku-reordered':
      return 'Reordered Shop Items';
    case 'shop-purchase-completed': {
      const itemCount =
        transaction.shopPurchaseItems?.reduce(
          (currentTotal, item) => currentTotal + item.quantity,
          0,
        ) ?? 0;

      if (
        transaction.childName &&
        itemCount > 0 &&
        transaction.pointsBefore != null &&
        transaction.pointsAfter != null
      ) {
        return `${transaction.childName} Purchased ${itemCount} Item${itemCount === 1 ? '' : 's'} [${transaction.pointsBefore} > ${transaction.pointsAfter}]`;
      }

      return 'Completed Shop Purchase';
    }
    case 'history-restored': {
      const targetTransaction = transaction.restoredToTransactionId
        ? transactionsById.get(transaction.restoredToTransactionId)
        : undefined;

      return `Restored App to ${summarizeRestoreTarget(
        targetTransaction,
        transactionsById,
      )}`;
    }
    case 'parent-mode-locked':
      return 'Parent Mode Locked';
    case 'parent-unlock-succeeded':
      return 'Parent PIN Unlock Succeeded';
    case 'parent-unlock-failed':
      return 'Parent PIN Unlock Failed';
    case 'timer-started':
      return 'Started Timer';
    case 'timer-paused':
      return 'Paused Timer';
    case 'timer-reset':
      return 'Reset Timer';
    case 'sync-applied':
      return 'Applied Device Sync';
    case 'timer-config-updated':
      return 'Updated Timer Settings';
  }
}

/**
 * Converts raw persisted transactions into the richer row model consumed by the
 * Transactions screen, including HEAD/orphaned/restorable state that depends on
 * the current history graph.
 */
export function deriveTransactionRows(document: SharedDocument) {
  const activeTransactionIds = getActiveTransactionIds(document);
  const transactionsById = getTransactionMap(document.transactions);
  const currentHeadTransaction = document.currentHeadTransactionId
    ? transactionsById.get(document.currentHeadTransactionId)
    : undefined;
  const currentRestoreTargetId =
    currentHeadTransaction?.kind === 'history-restored'
      ? (currentHeadTransaction.restoredToTransactionId ?? null)
      : null;

  return [...document.transactions].reverse().map((transaction) => {
    const isHead =
      transaction.participatesInHistory &&
      (transaction.id === document.currentHeadTransactionId ||
        transaction.id === currentRestoreTargetId);
    const isLocalOrigin = transaction.originDeviceId === document.deviceId;
    const isOrphaned = transaction.participatesInHistory
      ? !activeTransactionIds.has(transaction.id)
      : false;
    const isRestorableNow =
      transaction.isRestorable &&
      !isHead &&
      (!isOrphaned || document.isOrphanedRestoreWindowOpen);

    let restoreDisabledReason: string | undefined;

    if (!transaction.isRestorable) {
      restoreDisabledReason = 'Audit entries cannot be restored.';
    } else if (isHead) {
      restoreDisabledReason = 'This is the current HEAD transaction.';
    } else if (isOrphaned && !document.isOrphanedRestoreWindowOpen) {
      restoreDisabledReason =
        'This branch diverged from the current history and can no longer be restored.';
    }

    return {
      affectedChildIds: transaction.affectedChildIds,
      childId: transaction.childId,
      childName: transaction.childName,
      groupId: transaction.groupId,
      groupLabel: transaction.groupLabel,
      id: transaction.id,
      isHead,
      isLocalOrigin,
      isOrphaned,
      isRestorable: transaction.isRestorable,
      isRestorableNow,
      kind: transaction.kind,
      occurredAt: transaction.occurredAt,
      originDeviceId: transaction.originDeviceId,
      parentTransactionId: transaction.parentTransactionId,
      participatesInHistory: transaction.participatesInHistory,
      pointsAfter: transaction.pointsAfter,
      pointsBefore: transaction.pointsBefore,
      restoreDisabledReason,
      restoredFromTransactionId: transaction.restoredFromTransactionId,
      restoredToTransactionId: transaction.restoredToTransactionId,
      shopPurchaseItems: transaction.shopPurchaseItems?.map(
        cloneShopPurchaseItemSnapshot,
      ),
      shopPurchaseTotalCost: transaction.shopPurchaseTotalCost,
      shopSkuId: transaction.shopSkuId,
      shopSkuName: transaction.shopSkuName,
      stateAfter: cloneHead(transaction.stateAfter),
      summaryText: summarizeTransactionRow(transaction, transactionsById),
      timestampLabel: formatTransactionTimestamp(transaction.occurredAt),
    } satisfies TransactionRow;
  });
}

/**
 * Derives the child filter options from transaction history so archived and
 * deleted children remain filterable as long as they appear in the log.
 */
function deriveTransactionFilterChildren(document: SharedDocument) {
  const children = new Map<string, TransactionFilterChild>();

  for (const transaction of [...document.transactions].reverse()) {
    if (transaction.childId && transaction.childName) {
      children.set(transaction.childId, {
        id: transaction.childId,
        name: transaction.childName,
      });
    }
  }

  return [...children.values()];
}

function normalizeShopSkuName(name: string) {
  return normalizeName(name);
}

function isValidShopSkuImage(image: ShopSkuImageSnapshot) {
  return (
    image.aspectRatio === '4:3' &&
    typeof image.base64 === 'string' &&
    image.base64.length > 0 &&
    Number.isInteger(image.height) &&
    image.height > 0 &&
    typeof image.mimeType === 'string' &&
    image.mimeType.length > 0 &&
    Number.isInteger(image.width) &&
    image.width > 0
  );
}

function normalizeSkuOrderForHead(head: SharedHead, skuOrder: string[]) {
  const seenIds = new Set<string>();
  const normalizedIds = skuOrder.filter((skuId) => {
    if (seenIds.has(skuId) || !head.shop.skusById[skuId]) {
      return false;
    }

    seenIds.add(skuId);
    return true;
  });

  return [
    ...normalizedIds,
    ...Object.keys(head.shop.skusById).filter((skuId) => !seenIds.has(skuId)),
  ];
}

/**
 * Houses the command-style shared store API. Each action validates intent,
 * shapes any resulting events/transactions, and commits them through the
 * history model in one place.
 */
function createSharedStoreActions(
  set: (updater: (state: SharedStoreState) => SharedStoreState) => void,
) {
  return {
    applySyncBundle(
      bundle: SyncBundle,
      rollbackSnapshot: SyncRollbackSnapshot,
    ): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const currentProjection = deriveSyncProjection(state.document);
        const previouslyAppliedBundleHash =
          state.document.syncState?.lastAppliedSync?.bundleHash ?? null;

        if (previouslyAppliedBundleHash === bundle.bundleHash) {
          logSharedStoreMutation('applySyncBundle', {
            action: 'applySyncBundle',
            alreadyApplied: true,
            bundleHash: bundle.bundleHash,
          });
          return state;
        }

        if (
          currentProjection.headHash !== rollbackSnapshot.projectionHeadHash ||
          currentProjection.headSyncHash !==
            rollbackSnapshot.projectionHeadSyncHash
        ) {
          logRejectedSharedStoreMutation(
            'applySyncBundle',
            'The local shared state changed after the sync bundle was prepared.',
            {
              currentHeadHash: currentProjection.headHash,
              currentHeadSyncHash: currentProjection.headSyncHash,
              rollbackHeadHash: rollbackSnapshot.projectionHeadHash,
              rollbackHeadSyncHash: rollbackSnapshot.projectionHeadSyncHash,
            },
          );
          result = {
            error:
              'The local shared state changed after the sync bundle was prepared.',
            ok: false,
          };
          return state;
        }

        const nextHead = createSharedHeadFromSyncProjectionHead(
          bundle.mergedHead,
          state.document.head,
        );
        const occurredAt = new Date().toISOString();

        if (bundle.mode === 'bootstrap') {
          const auditTransaction = createTransactionRecord({
            affectedChildIds: [],
            childAfter: null,
            childBefore: null,
            childId: null,
            eventIds: [],
            isRestorable: false,
            kind: 'sync-applied',
            occurredAt,
            originDeviceId: state.document.deviceId,
            parentTransactionId: state.document.currentHeadTransactionId,
            participatesInHistory: false,
            stateAfter: nextHead,
          });
          const isEmptyLocalProjection = currentProjection.entries.length === 0;

          if (isEmptyLocalProjection) {
            const bootstrapHistory = bundle.bootstrapHistory;

            if (!bootstrapHistory || bootstrapHistory.length === 0) {
              logRejectedSharedStoreMutation(
                'applySyncBundle',
                'The bootstrap sync bundle was missing source history.',
                {
                  bundleHash: bundle.bundleHash,
                  mergedHeadSyncHash: bundle.mergedHeadSyncHash,
                },
              );
              result = {
                error: 'The bootstrap sync bundle was missing source history.',
                ok: false,
              };
              return state;
            }

            let parentTransactionId: string | null = null;
            const importedTransactions = bootstrapHistory.map((entry) => {
              const transaction = createTransactionRecordFromSyncEntry({
                entry,
                localHead: state.document.head,
                parentTransactionId,
              });

              parentTransactionId = transaction.id;
              return transaction;
            });
            const latestImportedTransaction =
              importedTransactions.at(-1) ?? null;
            const bootstrapAuditTransaction = {
              ...auditTransaction,
              parentTransactionId: latestImportedTransaction?.id ?? null,
            } satisfies TransactionRecord;
            const importedDocument = {
              ...state.document,
              currentHeadTransactionId: latestImportedTransaction?.id ?? null,
              head: cloneHead(nextHead),
              isOrphanedRestoreWindowOpen: false,
              transactions: [
                ...state.document.transactions,
                ...importedTransactions,
                bootstrapAuditTransaction,
              ],
            } satisfies SharedDocument;
            const nextDocument = {
              ...importedDocument,
              syncState: {
                lastAppliedSync: buildStoredSyncBundle(bundle, occurredAt),
                lastRollbackSnapshot:
                  buildStoredSyncRollbackSnapshot(rollbackSnapshot),
              },
            } satisfies SharedDocument;

            logSharedStoreMutation('applySyncBundle', {
              bundleHash: bundle.bundleHash,
              importedTransactionCount: importedTransactions.length,
              mergedHeadSyncHash: bundle.mergedHeadSyncHash,
              mode: bundle.mode,
              transactionId: bootstrapAuditTransaction.id,
            });
            logSharedTransaction(bootstrapAuditTransaction, {
              bundleHash: bundle.bundleHash,
              importedTransactionCount: importedTransactions.length,
              mergedHeadSyncHash: bundle.mergedHeadSyncHash,
            });

            return {
              ...state,
              document: nextDocument,
            };
          }

          const nextDocument = {
            ...appendDisplayOnlyTransaction({
              document: state.document,
              transaction: auditTransaction,
            }),
            syncState: {
              lastAppliedSync: buildStoredSyncBundle(bundle, occurredAt),
              lastRollbackSnapshot:
                buildStoredSyncRollbackSnapshot(rollbackSnapshot),
            },
          } satisfies SharedDocument;

          logSharedStoreMutation('applySyncBundle', {
            bundleHash: bundle.bundleHash,
            childReconciliationCount: bundle.childReconciliations.length,
            eventCount: 0,
            mergedHeadSyncHash: bundle.mergedHeadSyncHash,
            mode: bundle.mode,
            transactionId: auditTransaction.id,
          });
          logSharedTransaction(auditTransaction, {
            bundleHash: bundle.bundleHash,
            mergedHeadSyncHash: bundle.mergedHeadSyncHash,
          });

          return {
            ...state,
            document: nextDocument,
          };
        }

        const { affectedChildIds, eventsToAppend } = buildRestoreEvents(
          state.document,
          nextHead,
          occurredAt,
        );
        const transaction = createTransactionRecord({
          affectedChildIds,
          childAfter: null,
          childBefore: null,
          childId: null,
          eventIds: eventsToAppend.map((event) => event.eventId),
          kind: 'sync-applied',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          stateAfter: nextHead,
        });
        const committedDocument = commitDocumentChange({
          document: state.document,
          eventsToAppend,
          isOrphanedRestoreWindowOpen: false,
          nextHead,
          transaction,
        });
        const nextDocument = {
          ...committedDocument,
          syncState: {
            lastAppliedSync: buildStoredSyncBundle(bundle, occurredAt),
            lastRollbackSnapshot:
              buildStoredSyncRollbackSnapshot(rollbackSnapshot),
          },
        } satisfies SharedDocument;

        logSharedStoreMutation('applySyncBundle', {
          bundleHash: bundle.bundleHash,
          childReconciliationCount: bundle.childReconciliations.length,
          eventCount: eventsToAppend.length,
          mergedHeadSyncHash: bundle.mergedHeadSyncHash,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          bundleHash: bundle.bundleHash,
          mergedHeadSyncHash: bundle.mergedHeadSyncHash,
        });

        return {
          ...state,
          document: nextDocument,
        };
      });

      return result;
    },
    addChild(name: string): SharedCommandResult {
      const normalizedName = normalizeName(name);

      if (!normalizedName) {
        logRejectedSharedStoreMutation(
          'addChild',
          'Enter a child name before saving.',
        );
        return {
          error: 'Enter a child name before saving.',
          ok: false,
        };
      }

      const result: SharedCommandResult = { ok: true };

      set((state) => {
        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const child: ChildSnapshot = {
          createdAt: occurredAt,
          id: generateId('child'),
          name: normalizedName,
          points: 0,
          status: 'active',
          updatedAt: occurredAt,
        };
        const event = builder.build('child.created', { child }, occurredAt);
        const nextHead = applySharedEvent(state.document.head, event);
        const transaction = createTransactionRecord({
          affectedChildIds: [child.id],
          childAfter: child,
          childBefore: null,
          childId: child.id,
          eventIds: [event.eventId],
          kind: 'child-created',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          pointsAfter: child.points,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('addChild', {
          childId: child.id,
          eventId: event.eventId,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: [event],
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    adjustPoints(childId: string, delta: number): SharedCommandResult {
      if (!Number.isInteger(delta) || delta === 0) {
        logRejectedSharedStoreMutation(
          'adjustPoints',
          'Point adjustments must change the total by at least one.',
          { childId, delta },
        );
        return {
          error: 'Point adjustments must change the total by at least one.',
          ok: false,
        };
      }

      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const child = getChild(state.document.head, childId);

        if (!child || child.status !== 'active') {
          logRejectedSharedStoreMutation(
            'adjustPoints',
            'Only active children can be adjusted.',
            { childId, delta },
          );
          result = {
            error: 'Only active children can be adjusted.',
            ok: false,
          };
          return state;
        }

        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const event = builder.build(
          'child.pointsAdjusted',
          {
            childId,
            delta,
          },
          occurredAt,
        );
        const nextHead = applySharedEvent(state.document.head, event);
        const nextChild = getChild(nextHead, childId);
        const transaction = createTransactionRecord({
          affectedChildIds: [childId],
          childAfter: nextChild,
          childBefore: child,
          childId,
          eventIds: [event.eventId],
          kind: 'points-adjusted',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          pointsAfter: nextChild?.points,
          pointsBefore: child.points,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('adjustPoints', {
          childId,
          delta,
          eventId: event.eventId,
          pointsAfter: nextChild?.points ?? null,
          pointsBefore: child.points,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          delta,
          eventId: event.eventId,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: [event],
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    resolveCheckInSession(
      childDecisions: {
        childId: string;
        status: 'awarded' | 'dismissed';
      }[],
    ): SharedCommandResult {
      const uniqueChildDecisions = [
        ...new Map(
          childDecisions.map((childDecision) => [
            childDecision.childId,
            childDecision,
          ]),
        ).values(),
      ];

      if (uniqueChildDecisions.length === 0) {
        return { ok: true };
      }

      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const events: SharedEvent[] = [];
        let nextHead = cloneHead(state.document.head);
        let parentTransactionId = state.document.currentHeadTransactionId;
        const awardedCount = uniqueChildDecisions.filter(
          (childDecision) => childDecision.status === 'awarded',
        ).length;
        const dismissedCount = uniqueChildDecisions.filter(
          (childDecision) => childDecision.status === 'dismissed',
        ).length;
        const groupId = generateId('transaction-group');
        const groupLabel =
          awardedCount > 0 && dismissedCount > 0
            ? `Check-In Results +${awardedCount} Point${awardedCount === 1 ? '' : 's'}`
            : awardedCount > 0
              ? `Check-In Awards +${awardedCount} Point${awardedCount === 1 ? '' : 's'}`
              : 'Check-In Results';
        const transactions: TransactionRecord[] = [];

        for (const childDecision of uniqueChildDecisions) {
          const childBefore = getChild(nextHead, childDecision.childId);

          if (!childBefore || childBefore.status !== 'active') {
            logRejectedSharedStoreMutation(
              'resolveCheckInSession',
              'Only active children can be resolved in a check-in session.',
              {
                childDecisions: uniqueChildDecisions,
                childId: childDecision.childId,
              },
            );
            result = {
              error:
                'Only active children can be resolved in a check-in session.',
              ok: false,
            };
            return state;
          }

          if (childDecision.status === 'dismissed') {
            transactions.push(
              createTransactionRecord({
                affectedChildIds: [childDecision.childId],
                childAfter: childBefore,
                childBefore,
                childId: childDecision.childId,
                eventIds: [],
                groupId,
                groupLabel,
                isRestorable: false,
                kind: 'check-in-dismissed',
                occurredAt,
                originDeviceId: state.document.deviceId,
                parentTransactionId,
                participatesInHistory: false,
                stateAfter: nextHead,
              }),
            );
            continue;
          }

          const event = builder.build(
            'child.pointsAdjusted',
            {
              childId: childDecision.childId,
              delta: 1,
            },
            occurredAt,
          );

          events.push(event);
          nextHead = applySharedEvent(nextHead, event);
          const childAfter = getChild(nextHead, childDecision.childId);
          const transaction = createTransactionRecord({
            affectedChildIds: [childDecision.childId],
            childAfter,
            childBefore,
            childId: childDecision.childId,
            eventIds: [event.eventId],
            groupId,
            groupLabel,
            kind: 'points-adjusted',
            occurredAt,
            originDeviceId: state.document.deviceId,
            parentTransactionId,
            pointsAfter: childAfter?.points,
            pointsBefore: childBefore.points,
            stateAfter: nextHead,
          });

          parentTransactionId = transaction.id;
          transactions.push(transaction);
        }

        logSharedStoreMutation('resolveCheckInSession', {
          childDecisions: uniqueChildDecisions,
          dismissedCount,
          eventCount: events.length,
          groupId,
          transactionCount: transactions.length,
          awardedCount,
        });
        transactions.forEach((transaction) => {
          logSharedTransaction(transaction, {
            eventCount: transaction.eventIds.length,
            groupId,
          });
        });

        const sortedEvents = sortEventsCanonical([
          ...state.document.events,
          ...events,
        ]);

        return {
          ...state,
          document: {
            ...state.document,
            currentHeadTransactionId: parentTransactionId,
            events: sortedEvents,
            head: cloneHead(nextHead),
            isOrphanedRestoreWindowOpen: false,
            nextSequence: Math.max(
              state.document.nextSequence,
              deriveNextSequence(sortedEvents),
            ),
            transactions: [...state.document.transactions, ...transactions],
          },
        };
      });

      return result;
    },
    archiveChild(childId: string): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const child = getChild(state.document.head, childId);

        if (!child || child.status !== 'active') {
          logRejectedSharedStoreMutation(
            'archiveChild',
            'Only active children can be archived.',
            { childId },
          );
          result = {
            error: 'Only active children can be archived.',
            ok: false,
          };
          return state;
        }

        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const event = builder.build('child.archived', { childId }, occurredAt);
        const nextHead = applySharedEvent(state.document.head, event);
        const nextChild = getChild(nextHead, childId);
        const transaction = createTransactionRecord({
          affectedChildIds: [childId],
          childAfter: nextChild,
          childBefore: child,
          childId,
          eventIds: [event.eventId],
          kind: 'child-archived',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          pointsAfter: nextChild?.points,
          pointsBefore: child.points,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('archiveChild', {
          childId,
          eventId: event.eventId,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: [event],
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    createShopSku(input: {
      image: ShopSkuImageSnapshot;
      name: string;
      pointCost: number;
    }): SharedCommandResult {
      const name = normalizeShopSkuName(input.name);

      if (!name) {
        logRejectedSharedStoreMutation(
          'createShopSku',
          'Enter an item name before saving.',
        );
        return {
          error: 'Enter an item name before saving.',
          ok: false,
        };
      }

      if (!Number.isInteger(input.pointCost) || input.pointCost < 0) {
        logRejectedSharedStoreMutation(
          'createShopSku',
          'Item cost must be a whole number of points.',
          {
            pointCost: input.pointCost,
          },
        );
        return {
          error: 'Item cost must be a whole number of points.',
          ok: false,
        };
      }

      if (!isValidShopSkuImage(input.image)) {
        logRejectedSharedStoreMutation(
          'createShopSku',
          'Add a valid item photo before saving.',
        );
        return {
          error: 'Add a valid item photo before saving.',
          ok: false,
        };
      }

      const result: SharedCommandResult = { ok: true };

      set((state) => {
        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const sku: ShopSkuSnapshot = {
          createdAt: occurredAt,
          id: generateId('sku'),
          image: cloneShopSkuImageSnapshot(input.image),
          name,
          pointCost: input.pointCost,
          updatedAt: occurredAt,
        };
        const event = builder.build('shop.skuCreated', { sku }, occurredAt);
        const nextHead = applySharedEvent(state.document.head, event);
        const transaction = createTransactionRecord({
          affectedChildIds: [],
          childAfter: null,
          childBefore: null,
          childId: null,
          eventIds: [event.eventId],
          kind: 'shop-sku-created',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          shopSkuId: sku.id,
          shopSkuName: sku.name,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('createShopSku', {
          eventId: event.eventId,
          skuId: sku.id,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
          skuId: sku.id,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: [event],
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    updateShopSku(
      skuId: string,
      updates: {
        image: ShopSkuImageSnapshot;
        name: string;
        pointCost: number;
      },
    ): SharedCommandResult {
      const name = normalizeShopSkuName(updates.name);

      if (!name) {
        logRejectedSharedStoreMutation(
          'updateShopSku',
          'Enter an item name before saving.',
          { skuId },
        );
        return {
          error: 'Enter an item name before saving.',
          ok: false,
        };
      }

      if (!Number.isInteger(updates.pointCost) || updates.pointCost < 0) {
        logRejectedSharedStoreMutation(
          'updateShopSku',
          'Item cost must be a whole number of points.',
          {
            pointCost: updates.pointCost,
            skuId,
          },
        );
        return {
          error: 'Item cost must be a whole number of points.',
          ok: false,
        };
      }

      if (!isValidShopSkuImage(updates.image)) {
        logRejectedSharedStoreMutation(
          'updateShopSku',
          'Add a valid item photo before saving.',
          { skuId },
        );
        return {
          error: 'Add a valid item photo before saving.',
          ok: false,
        };
      }

      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const currentSku = state.document.head.shop.skusById[skuId] ?? null;

        if (!currentSku) {
          logRejectedSharedStoreMutation(
            'updateShopSku',
            'That shop item could not be found.',
            { skuId },
          );
          result = {
            error: 'That shop item could not be found.',
            ok: false,
          };
          return state;
        }

        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const sku: ShopSkuSnapshot = {
          ...currentSku,
          image: cloneShopSkuImageSnapshot(updates.image),
          name,
          pointCost: updates.pointCost,
          updatedAt: occurredAt,
        };
        const event = builder.build('shop.skuUpdated', { sku }, occurredAt);
        const nextHead = applySharedEvent(state.document.head, event);
        const transaction = createTransactionRecord({
          affectedChildIds: [],
          childAfter: null,
          childBefore: null,
          childId: null,
          eventIds: [event.eventId],
          kind: 'shop-sku-updated',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          shopSkuId: sku.id,
          shopSkuName: sku.name,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('updateShopSku', {
          eventId: event.eventId,
          skuId,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
          skuId,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: [event],
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    reorderShopSkus(skuOrder: string[]): SharedCommandResult {
      const result: SharedCommandResult = { ok: true };

      set((state) => {
        const normalizedOrder = normalizeSkuOrderForHead(
          state.document.head,
          skuOrder,
        );

        if (
          normalizedOrder.join('|') ===
          state.document.head.shop.skuOrder.join('|')
        ) {
          return state;
        }

        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const event = builder.build(
          'shop.skuOrderUpdated',
          {
            skuOrder: normalizedOrder,
          },
          occurredAt,
        );
        const nextHead = applySharedEvent(state.document.head, event);
        const transaction = createTransactionRecord({
          affectedChildIds: [],
          childAfter: null,
          childBefore: null,
          childId: null,
          eventIds: [event.eventId],
          kind: 'shop-sku-reordered',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('reorderShopSkus', {
          eventId: event.eventId,
          skuCount: normalizedOrder.length,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
          skuCount: normalizedOrder.length,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: [event],
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    completeShopPurchase(
      childId: string,
      items: {
        quantity: number;
        skuId: string;
      }[],
    ): SharedCommandResult {
      const normalizedItems = items
        .filter(
          (item) =>
            typeof item.skuId === 'string' &&
            item.skuId.length > 0 &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0,
        )
        .map((item) => ({
          quantity: item.quantity,
          skuId: item.skuId,
        }));

      if (normalizedItems.length === 0) {
        logRejectedSharedStoreMutation(
          'completeShopPurchase',
          'Add at least one item to the cart before checking out.',
          { childId },
        );
        return {
          error: 'Add at least one item to the cart before checking out.',
          ok: false,
        };
      }

      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const child = getChild(state.document.head, childId);

        if (!child || child.status !== 'active') {
          logRejectedSharedStoreMutation(
            'completeShopPurchase',
            'Only active children can complete a shop purchase.',
            { childId },
          );
          result = {
            error: 'Only active children can complete a shop purchase.',
            ok: false,
          };
          return state;
        }

        const purchaseItems: ShopPurchaseItemSnapshot[] = [];

        for (const item of normalizedItems) {
          const sku = state.document.head.shop.skusById[item.skuId] ?? null;

          if (!sku) {
            logRejectedSharedStoreMutation(
              'completeShopPurchase',
              'One of the cart items no longer exists in the shop.',
              {
                childId,
                skuId: item.skuId,
              },
            );
            result = {
              error: 'One of the cart items no longer exists in the shop.',
              ok: false,
            };
            return state;
          }

          purchaseItems.push({
            lineTotal: sku.pointCost * item.quantity,
            pointCost: sku.pointCost,
            quantity: item.quantity,
            skuId: sku.id,
            skuName: sku.name,
          });
        }

        const totalPointCost = purchaseItems.reduce(
          (currentTotal, item) => currentTotal + item.lineTotal,
          0,
        );

        if (child.points < totalPointCost) {
          logRejectedSharedStoreMutation(
            'completeShopPurchase',
            'That child does not have enough points for this cart.',
            {
              childId,
              childPoints: child.points,
              totalPointCost,
            },
          );
          result = {
            error: 'That child does not have enough points for this cart.',
            ok: false,
          };
          return state;
        }

        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const event = builder.build(
          'shop.purchaseCompleted',
          {
            childId,
            items: purchaseItems.map(cloneShopPurchaseItemSnapshot),
            totalPointCost,
          },
          occurredAt,
        );
        const nextHead = applySharedEvent(state.document.head, event);
        const nextChild = getChild(nextHead, childId);
        const transaction = createTransactionRecord({
          affectedChildIds: [childId],
          childAfter: nextChild,
          childBefore: child,
          childId,
          eventIds: [event.eventId],
          kind: 'shop-purchase-completed',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          pointsAfter: nextChild?.points,
          pointsBefore: child.points,
          shopPurchaseItems: purchaseItems,
          shopPurchaseTotalCost: totalPointCost,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('completeShopPurchase', {
          childId,
          eventId: event.eventId,
          itemCount: purchaseItems.length,
          totalPointCost,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
          itemCount: purchaseItems.length,
          totalPointCost,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: [event],
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    deleteChildPermanently(childId: string): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const child = getChild(state.document.head, childId);

        if (!child || child.status !== 'archived') {
          logRejectedSharedStoreMutation(
            'deleteChildPermanently',
            'Only archived children can be deleted permanently.',
            { childId },
          );
          result = {
            error: 'Only archived children can be deleted permanently.',
            ok: false,
          };
          return state;
        }

        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const event = builder.build('child.deleted', { childId }, occurredAt);
        const nextHead = applySharedEvent(state.document.head, event);
        const transaction = createTransactionRecord({
          affectedChildIds: [childId],
          childAfter: null,
          childBefore: child,
          childId,
          eventIds: [event.eventId],
          kind: 'child-deleted',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          pointsBefore: child.points,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('deleteChildPermanently', {
          childId,
          eventId: event.eventId,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: [event],
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    pauseTimer(): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const now = Date.now();
        const snapshot = computeSharedTimerSnapshot(
          state.document.head.timerConfig,
          state.document.head.timerState,
          now,
        );

        if (snapshot.status !== 'running') {
          logRejectedSharedStoreMutation(
            'pauseTimer',
            'The timer is not currently running.',
            { timerStatus: snapshot.status },
          );
          result = {
            error: 'The timer is not currently running.',
            ok: false,
          };
          return state;
        }

        const occurredAt = new Date(now).toISOString();
        const builder = createEventBuilder(state.document);
        const nextTimerState = buildPausedTimerState(
          state.document.head.timerConfig,
          state.document.head.timerState,
          now,
        );
        const event = builder.build(
          'timer.stateUpdated',
          {
            timerState: nextTimerState,
          },
          occurredAt,
        );
        const nextHead = applySharedEvent(state.document.head, event);
        const transaction = createTransactionRecord({
          affectedChildIds: [],
          childAfter: null,
          childBefore: null,
          childId: null,
          eventIds: [event.eventId],
          isRestorable: false,
          kind: 'timer-paused',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          participatesInHistory: false,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('pauseTimer', {
          eventId: event.eventId,
          pausedRemainingMs: nextTimerState.pausedRemainingMs,
          timerStatus: snapshot.status,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
        });

        return {
          ...state,
          document: commitTransientHeadChange({
            document: state.document,
            eventsToAppend: [event],
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    resetTimer(): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const now = Date.now();
        const snapshot = computeSharedTimerSnapshot(
          state.document.head.timerConfig,
          state.document.head.timerState,
          now,
        );

        if (
          snapshot.status === 'idle' &&
          areTimerStatesEquivalent(
            state.document.head.timerState,
            DEFAULT_TIMER_STATE,
          )
        ) {
          logRejectedSharedStoreMutation(
            'resetTimer',
            'The timer is already reset.',
          );
          result = {
            error: 'The timer is already reset.',
            ok: false,
          };
          return state;
        }

        const occurredAt = new Date(now).toISOString();
        const builder = createEventBuilder(state.document);
        const nextTimerState = buildResetTimerState();
        const event = builder.build(
          'timer.stateUpdated',
          {
            timerState: nextTimerState,
          },
          occurredAt,
        );
        const nextHead = applySharedEvent(state.document.head, event);
        const transaction = createTransactionRecord({
          affectedChildIds: [],
          childAfter: null,
          childBefore: null,
          childId: null,
          eventIds: [event.eventId],
          isRestorable: false,
          kind: 'timer-reset',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          participatesInHistory: false,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('resetTimer', {
          eventId: event.eventId,
          timerStatus: snapshot.status,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
        });

        return {
          ...state,
          document: commitTransientHeadChange({
            document: state.document,
            eventsToAppend: [event],
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    recordParentUnlockAttempt(success: boolean): SharedCommandResult {
      const result: SharedCommandResult = { ok: true };

      set((state) => {
        const occurredAt = new Date().toISOString();
        const transaction = createTransactionRecord({
          affectedChildIds: [],
          childAfter: null,
          childBefore: null,
          childId: null,
          eventIds: [],
          isRestorable: false,
          kind: success ? 'parent-unlock-succeeded' : 'parent-unlock-failed',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          participatesInHistory: false,
          stateAfter: state.document.head,
        });

        logSharedStoreMutation('recordParentUnlockAttempt', {
          outcome: success ? 'succeeded' : 'failed',
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          outcome: success ? 'succeeded' : 'failed',
        });

        return {
          ...state,
          document: appendDisplayOnlyTransaction({
            document: state.document,
            transaction,
          }),
        };
      });

      return result;
    },
    recordParentModeLocked(): SharedCommandResult {
      const result: SharedCommandResult = { ok: true };

      set((state) => {
        const occurredAt = new Date().toISOString();
        const transaction = createTransactionRecord({
          affectedChildIds: [],
          childAfter: null,
          childBefore: null,
          childId: null,
          eventIds: [],
          isRestorable: false,
          kind: 'parent-mode-locked',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          participatesInHistory: false,
          stateAfter: state.document.head,
        });

        logSharedStoreMutation('recordParentModeLocked', {
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction);

        return {
          ...state,
          document: appendDisplayOnlyTransaction({
            document: state.document,
            transaction,
          }),
        };
      });

      return result;
    },
    revertLastSync(): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const rollbackSnapshot = state.document.syncState?.lastRollbackSnapshot;

        if (!rollbackSnapshot) {
          logRejectedSharedStoreMutation(
            'revertLastSync',
            'There is no applied sync to revert.',
          );
          result = {
            error: 'There is no applied sync to revert.',
            ok: false,
          };
          return state;
        }

        const revertedDocument = cloneSharedDocument({
          ...rollbackSnapshot.documentSnapshot,
          schemaVersion: 6,
          syncState: null,
        });

        logSharedStoreMutation('revertLastSync', {
          rollbackCapturedAt: rollbackSnapshot.capturedAt,
          rollbackHeadHash: rollbackSnapshot.projectionHeadHash,
          rollbackHeadSyncHash: rollbackSnapshot.projectionHeadSyncHash,
        });

        return {
          ...state,
          document: revertedDocument,
        };
      });

      return result;
    },
    restoreChild(childId: string): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const child = getChild(state.document.head, childId);

        if (!child || child.status !== 'archived') {
          logRejectedSharedStoreMutation(
            'restoreChild',
            'Only archived children can be restored.',
            { childId },
          );
          result = {
            error: 'Only archived children can be restored.',
            ok: false,
          };
          return state;
        }

        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const event = builder.build('child.restored', { childId }, occurredAt);
        const nextHead = applySharedEvent(state.document.head, event);
        const nextChild = getChild(nextHead, childId);
        const transaction = createTransactionRecord({
          affectedChildIds: [childId],
          childAfter: nextChild,
          childBefore: child,
          childId,
          eventIds: [event.eventId],
          kind: 'child-restored',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          pointsAfter: nextChild?.points,
          pointsBefore: child.points,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('restoreChild', {
          childId,
          eventId: event.eventId,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: [event],
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    restoreTransaction(transactionId: string): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const transactionRow = deriveTransactionRows(state.document).find(
          (row) => row.id === transactionId,
        );

        if (!transactionRow) {
          logRejectedSharedStoreMutation(
            'restoreTransaction',
            'The requested transaction could not be restored.',
            { transactionId },
          );
          result = {
            error: 'The requested transaction could not be restored.',
            ok: false,
          };
          return state;
        }

        if (!transactionRow.isRestorableNow) {
          logRejectedSharedStoreMutation(
            'restoreTransaction',
            transactionRow.restoreDisabledReason ??
              'That transaction cannot be restored right now.',
            { transactionId },
          );
          result = {
            error:
              transactionRow.restoreDisabledReason ??
              'That transaction cannot be restored right now.',
            ok: false,
          };
          return state;
        }

        if (
          areHeadsEquivalent(state.document.head, transactionRow.stateAfter) &&
          transactionRow.id === state.document.currentHeadTransactionId
        ) {
          logRejectedSharedStoreMutation(
            'restoreTransaction',
            'That transaction is already the current HEAD.',
            { transactionId },
          );
          result = {
            error: 'That transaction is already the current HEAD.',
            ok: false,
          };
          return state;
        }

        const occurredAt = new Date().toISOString();
        const targetHead = cloneHeadWithTimerState(
          transactionRow.stateAfter,
          state.document.head.timerState,
        );
        const { affectedChildIds, eventsToAppend } = buildRestoreEvents(
          state.document,
          targetHead,
          occurredAt,
        );
        const transaction = createTransactionRecord({
          affectedChildIds,
          childAfter: null,
          childBefore: null,
          childId: null,
          eventIds: eventsToAppend.map((event) => event.eventId),
          kind: 'history-restored',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: transactionRow.id,
          restoredFromTransactionId:
            state.document.currentHeadTransactionId ?? undefined,
          restoredToTransactionId: transactionRow.id,
          stateAfter: targetHead,
          transactionId: generateId('transaction'),
        });

        logSharedStoreMutation('restoreTransaction', {
          eventCount: eventsToAppend.length,
          restoredToTransactionId: transactionRow.id,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventCount: eventsToAppend.length,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend,
            isOrphanedRestoreWindowOpen: true,
            nextHead: targetHead,
            transaction,
          }),
        };
      });

      return result;
    },
    setPoints(childId: string, points: number): SharedCommandResult {
      if (!Number.isInteger(points)) {
        logRejectedSharedStoreMutation(
          'setPoints',
          'Exact point totals must be whole numbers.',
          { childId, points },
        );
        return {
          error: 'Exact point totals must be whole numbers.',
          ok: false,
        };
      }

      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const child = getChild(state.document.head, childId);

        if (!child) {
          logRejectedSharedStoreMutation(
            'setPoints',
            'That child could not be found.',
            { childId, points },
          );
          result = {
            error: 'That child could not be found.',
            ok: false,
          };
          return state;
        }

        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const event = builder.build(
          'child.pointsSet',
          {
            childId,
            points,
          },
          occurredAt,
        );
        const nextHead = applySharedEvent(state.document.head, event);
        const nextChild = getChild(nextHead, childId);
        const transaction = createTransactionRecord({
          affectedChildIds: [childId],
          childAfter: nextChild,
          childBefore: child,
          childId,
          eventIds: [event.eventId],
          kind: 'points-set',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          pointsAfter: nextChild?.points,
          pointsBefore: child.points,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('setPoints', {
          childId,
          eventId: event.eventId,
          pointsAfter: nextChild?.points ?? null,
          pointsBefore: child.points,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: [event],
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    startTimer(): SharedCommandResult {
      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const now = Date.now();
        const snapshot = computeSharedTimerSnapshot(
          state.document.head.timerConfig,
          state.document.head.timerState,
          now,
        );

        if (snapshot.status === 'running') {
          logRejectedSharedStoreMutation(
            'startTimer',
            'The timer is already running.',
          );
          result = {
            error: 'The timer is already running.',
            ok: false,
          };
          return state;
        }

        const occurredAt = new Date(now).toISOString();
        const builder = createEventBuilder(state.document);
        const nextTimerState = buildStartedTimerState(
          state.document.head.timerConfig,
          state.document.head.timerState,
          now,
        );
        const event = builder.build(
          'timer.stateUpdated',
          {
            timerState: nextTimerState,
          },
          occurredAt,
        );
        const nextHead = applySharedEvent(state.document.head, event);
        const transaction = createTransactionRecord({
          affectedChildIds: [],
          childAfter: null,
          childBefore: null,
          childId: null,
          eventIds: [event.eventId],
          isRestorable: false,
          kind: 'timer-started',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          participatesInHistory: false,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('startTimer', {
          cycleStartedAt: nextTimerState.cycleStartedAt,
          eventId: event.eventId,
          timerStatus: snapshot.status,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
        });

        return {
          ...state,
          document: commitTransientHeadChange({
            document: state.document,
            eventsToAppend: [event],
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
    updateTimerConfig(
      updates: Partial<SharedTimerConfig>,
    ): SharedCommandResult {
      const values = Object.values(updates).filter((value) => value != null);

      if (
        values.some(
          (value) =>
            typeof value !== 'number' ||
            !Number.isFinite(value) ||
            !Number.isInteger(value),
        )
      ) {
        logRejectedSharedStoreMutation(
          'updateTimerConfig',
          'Timer settings must use whole-number values.',
          updates,
        );
        return {
          error: 'Timer settings must use whole-number values.',
          ok: false,
        };
      }

      const result: SharedCommandResult = { ok: true };

      set((state) => {
        const nextTimerConfig = normalizeTimerConfig(
          {
            ...state.document.head.timerConfig,
            ...updates,
          },
          state.document.head.timerConfig,
        );

        if (
          areTimerConfigsEquivalent(
            state.document.head.timerConfig,
            nextTimerConfig,
          )
        ) {
          return state;
        }

        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const event = builder.build(
          'timer.configUpdated',
          {
            timerConfig: nextTimerConfig,
          },
          occurredAt,
        );
        const nextHead = applySharedEvent(state.document.head, event);
        const transaction = createTransactionRecord({
          affectedChildIds: [],
          childAfter: null,
          childBefore: null,
          childId: null,
          eventIds: [event.eventId],
          kind: 'timer-config-updated',
          occurredAt,
          originDeviceId: state.document.deviceId,
          parentTransactionId: state.document.currentHeadTransactionId,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('updateTimerConfig', {
          alarmDurationSeconds: nextTimerConfig.alarmDurationSeconds,
          eventId: event.eventId,
          intervalMinutes: nextTimerConfig.intervalMinutes,
          intervalSeconds: nextTimerConfig.intervalSeconds,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          eventId: event.eventId,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: [event],
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
        };
      });

      return result;
    },
  };
}

export function createSharedStore({
  initialDocument = createInitialSharedDocument(),
  storage = AsyncStorage,
}: {
  initialDocument?: SharedDocument;
  storage?: StateStorage;
} = {}) {
  return createStore<SharedStoreState>()(
    persist(
      (set) => ({
        ...createSharedStoreActions((updater) => {
          set((state) => updater(state));
        }),
        document: cloneSharedDocument(initialDocument),
      }),
      {
        merge: (persistedState, currentState) => {
          const nextState = persistedState as Partial<SharedStoreState> | null;

          if (!isSharedDocument(nextState?.document)) {
            logSkippedInvalidSharedStoreRehydrate();
            return currentState;
          }

          logSharedStoreRehydrated({
            currentHeadTransactionId:
              nextState.document.currentHeadTransactionId,
            eventCount: nextState.document.events.length,
            transactionCount: nextState.document.transactions.length,
          });

          return {
            ...currentState,
            document: cloneSharedDocument(nextState.document),
          };
        },
        name: SHARED_STORAGE_KEY,
        partialize: ({ document }) => ({ document }),
        storage: createJSONStorage(() => storage),
      },
    ),
  );
}

export function SharedStoreProvider({
  children,
  initialDocument,
  storage,
}: SharedStoreProviderProps) {
  const store = useStableStoreReference(
    () =>
      createSharedStore({
        initialDocument,
        storage,
      }),
    {
      devRefreshToken: SHARED_STORE_BUILD_TOKEN,
    },
  );

  useEffect(() => {
    log.info('Shared store provider initialized');
  }, []);

  return (
    <SharedStoreContext.Provider value={store}>
      {children}
    </SharedStoreContext.Provider>
  );
}

export function useSharedStore<T>(selector: (state: SharedStoreState) => T) {
  const store = useContext(SharedStoreContext);

  if (!store) {
    throw new Error('useSharedStore must be used within SharedStoreProvider');
  }

  return useStore(store, selector);
}

export function useSharedStoreApi() {
  const store = useContext(SharedStoreContext);

  if (!store) {
    throw new Error(
      'useSharedStoreApi must be used within SharedStoreProvider',
    );
  }

  return store;
}

export function selectActiveChildren(state: SharedStoreState) {
  return state.document.head.activeChildIds
    .map((childId) => state.document.head.childrenById[childId])
    .filter(Boolean);
}

export function selectArchivedChildren(state: SharedStoreState) {
  return state.document.head.archivedChildIds
    .map((childId) => state.document.head.childrenById[childId])
    .filter(Boolean);
}

export function selectHasActiveChildren(state: SharedStoreState) {
  return state.document.head.activeChildIds.length > 0;
}

export function selectSharedTimerConfig(state: SharedStoreState) {
  return state.document.head.timerConfig;
}

export function selectSharedTimerState(state: SharedStoreState) {
  return state.document.head.timerState;
}

export function selectTransactionRows(state: SharedStoreState) {
  return deriveTransactionRows(state.document);
}

export function selectTransactionFilterChildren(state: SharedStoreState) {
  return deriveTransactionFilterChildren(state.document);
}

export function selectChildById(childId: string) {
  return (state: SharedStoreState) =>
    state.document.head.childrenById[childId] ?? null;
}

export function useSharedTransactions() {
  const rows = useSharedStore(selectTransactionRows);

  return useMemo(() => rows, [rows]);
}
