export type ChildStatus = 'active' | 'archived';

export type ChildSnapshot = {
  archivedAt?: string;
  createdAt: string;
  id: string;
  name: string;
  points: number;
  status: ChildStatus;
  updatedAt: string;
};

export type ShopSkuImageSnapshot = {
  aspectRatio: '4:3';
  base64: string;
  height: number;
  mimeType: string;
  width: number;
};

export type ShopSkuSnapshot = {
  createdAt: string;
  id: string;
  image: ShopSkuImageSnapshot;
  name: string;
  pointCost: number;
  updatedAt: string;
};

export type ShopPurchaseItemSnapshot = {
  lineTotal: number;
  pointCost: number;
  quantity: number;
  skuId: string;
  skuName: string;
};

export type SharedShopState = {
  skuOrder: string[];
  skusById: Record<string, ShopSkuSnapshot>;
};

export type SharedTimerConfig = {
  alarmDurationSeconds: number;
  intervalMinutes: number;
  intervalSeconds: number;
};

export type SharedTimerMode = 'idle' | 'paused' | 'running';

export type SharedTimerState = {
  activeIntervalMs: number | null;
  cycleStartedAt: number | null;
  mode: SharedTimerMode;
  pausedRemainingMs: number | null;
};

export type SharedHead = {
  activeChildIds: string[];
  archivedChildIds: string[];
  childrenById: Record<string, ChildSnapshot>;
  shop: SharedShopState;
  timerConfig: SharedTimerConfig;
  timerState: SharedTimerState;
};

export type SharedEventBase = {
  deviceId: string;
  eventId: string;
  occurredAt: string;
  sequence: number;
};

export type ChildCreatedEvent = SharedEventBase & {
  payload: {
    child: ChildSnapshot;
  };
  type: 'child.created';
};

export type ChildPointsAdjustedEvent = SharedEventBase & {
  payload: {
    childId: string;
    delta: number;
  };
  type: 'child.pointsAdjusted';
};

export type ChildPointsSetEvent = SharedEventBase & {
  payload: {
    childId: string;
    points: number;
  };
  type: 'child.pointsSet';
};

export type ChildArchivedEvent = SharedEventBase & {
  payload: {
    childId: string;
  };
  type: 'child.archived';
};

export type ChildDeletedEvent = SharedEventBase & {
  payload: {
    childId: string;
  };
  type: 'child.deleted';
};

export type ChildRestoredEvent = SharedEventBase & {
  payload: {
    childId: string;
  };
  type: 'child.restored';
};

export type ShopSkuCreatedEvent = SharedEventBase & {
  payload: {
    sku: ShopSkuSnapshot;
  };
  type: 'shop.skuCreated';
};

export type ShopSkuDeletedEvent = SharedEventBase & {
  payload: {
    skuId: string;
  };
  type: 'shop.skuDeleted';
};

export type ShopSkuUpdatedEvent = SharedEventBase & {
  payload: {
    sku: ShopSkuSnapshot;
  };
  type: 'shop.skuUpdated';
};

export type ShopSkuOrderUpdatedEvent = SharedEventBase & {
  payload: {
    skuOrder: string[];
  };
  type: 'shop.skuOrderUpdated';
};

export type ShopPurchaseCompletedEvent = SharedEventBase & {
  payload: {
    childId: string;
    items: ShopPurchaseItemSnapshot[];
    totalPointCost: number;
  };
  type: 'shop.purchaseCompleted';
};

export type TimerConfigUpdatedEvent = SharedEventBase & {
  payload: {
    timerConfig: SharedTimerConfig;
  };
  type: 'timer.configUpdated';
};

export type TimerStateUpdatedEvent = SharedEventBase & {
  payload: {
    timerState: SharedTimerState;
  };
  type: 'timer.stateUpdated';
};

export type SharedEvent =
  | ChildArchivedEvent
  | ChildCreatedEvent
  | ChildDeletedEvent
  | ChildPointsAdjustedEvent
  | ChildPointsSetEvent
  | ChildRestoredEvent
  | ShopPurchaseCompletedEvent
  | ShopSkuCreatedEvent
  | ShopSkuDeletedEvent
  | ShopSkuOrderUpdatedEvent
  | ShopSkuUpdatedEvent
  | TimerConfigUpdatedEvent
  | TimerStateUpdatedEvent;

export type TransactionKind =
  | 'check-in-resolved'
  | 'check-in-dismissed'
  | 'child-archived'
  | 'child-created'
  | 'child-deleted'
  | 'child-restored'
  | 'history-restored'
  | 'parent-mode-locked'
  | 'parent-unlock-failed'
  | 'parent-unlock-succeeded'
  | 'points-adjusted'
  | 'points-set'
  | 'shop-purchase-completed'
  | 'shop-sku-created'
  | 'shop-sku-reordered'
  | 'shop-sku-updated'
  | 'sync-applied'
  | 'timer-config-updated'
  | 'timer-paused'
  | 'timer-reset'
  | 'timer-started';

export type TransactionRecord = {
  affectedChildIds: string[];
  childId: string | null;
  childName: string | null;
  eventIds: string[];
  groupId?: string;
  groupLabel?: string;
  id: string;
  originDeviceId: string;
  kind: TransactionKind;
  occurredAt: string;
  parentTransactionId: string | null;
  participatesInHistory: boolean;
  pointsAfter?: number;
  pointsBefore?: number;
  isRestorable: boolean;
  restoredFromTransactionId?: string;
  restoredToTransactionId?: string;
  shopPurchaseItems?: ShopPurchaseItemSnapshot[];
  shopPurchaseTotalCost?: number;
  shopSkuId?: string;
  shopSkuName?: string;
  stateAfter: SharedHead;
};

export type TransactionFilterChild = {
  id: string;
  name: string;
};

export type TransactionRow = {
  affectedChildIds: string[];
  childId: string | null;
  childName: string | null;
  groupId?: string;
  groupLabel?: string;
  id: string;
  isHead: boolean;
  isLocalOrigin: boolean;
  isOrphaned: boolean;
  isRestorable: boolean;
  isRestorableNow: boolean;
  kind: TransactionKind;
  occurredAt: string;
  originDeviceId: string;
  parentTransactionId: string | null;
  participatesInHistory: boolean;
  pointsAfter?: number;
  pointsBefore?: number;
  restoreDisabledReason?: string;
  restoredFromTransactionId?: string;
  restoredToTransactionId?: string;
  shopPurchaseItems?: ShopPurchaseItemSnapshot[];
  shopPurchaseTotalCost?: number;
  shopSkuId?: string;
  shopSkuName?: string;
  stateAfter: SharedHead;
  summaryText: string;
  timestampLabel: string;
};

export type SharedDocument = {
  currentHeadTransactionId: string | null;
  deviceId: string;
  events: SharedEvent[];
  head: SharedHead;
  isOrphanedRestoreWindowOpen: boolean;
  nextSequence: number;
  schemaVersion: 6;
  syncState: SharedSyncState | null;
  transactions: TransactionRecord[];
};

export type SharedCommandResult = { ok: true } | { error: string; ok: false };

export type SharedDocumentSnapshot = {
  currentHeadTransactionId: string | null;
  deviceId: string;
  events: SharedEvent[];
  head: SharedHead;
  isOrphanedRestoreWindowOpen: boolean;
  nextSequence: number;
  schemaVersion: 3 | 4 | 5 | 6;
  transactions: TransactionRecord[];
};

export type StoredSyncPointReconciliation = {
  basePoints: number;
  childId: string;
  childName: string;
  leftDelta: number;
  leftPoints: number;
  mergedPoints: number;
  rightDelta: number;
  rightPoints: number;
};

export type StoredSyncBundle = {
  appliedAt: string;
  bundleHash: string;
  childReconciliations: StoredSyncPointReconciliation[];
  commonBaseHash: string | null;
  mergedHeadSyncHash: string;
  mode: 'bootstrap' | 'merged';
  participantHeadHashes: string[];
  participantHeadSyncHashes: string[];
  syncSchemaVersion: 1 | 2;
};

export type StoredSyncRollbackSnapshot = {
  capturedAt: string;
  documentSnapshot: SharedDocumentSnapshot;
  projectionHeadHash: string;
  projectionHeadSyncHash: string;
};

export type SharedSyncState = {
  lastAppliedSync: StoredSyncBundle | null;
  lastRollbackSnapshot: StoredSyncRollbackSnapshot | null;
};
