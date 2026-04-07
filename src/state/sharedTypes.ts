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

export type HomeTimerSummary = {
  intervalLabel: string;
  remainingLabel: string;
  statusLabel: string;
};

export type SharedHead = {
  activeChildIds: string[];
  archivedChildIds: string[];
  childrenById: Record<string, ChildSnapshot>;
  homeTimerSummary: HomeTimerSummary;
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

export type SharedEvent =
  | ChildArchivedEvent
  | ChildCreatedEvent
  | ChildDeletedEvent
  | ChildPointsAdjustedEvent
  | ChildPointsSetEvent
  | ChildRestoredEvent;

export type TransactionKind =
  | 'child-archived'
  | 'child-created'
  | 'child-deleted'
  | 'child-restored'
  | 'history-restored'
  | 'points-adjusted'
  | 'points-set';

export type TransactionRecord = {
  affectedChildIds: string[];
  childId: string | null;
  childName: string | null;
  eventIds: string[];
  id: string;
  kind: TransactionKind;
  occurredAt: string;
  parentTransactionId: string | null;
  pointsAfter?: number;
  pointsBefore?: number;
  restoredFromTransactionId?: string;
  restoredToTransactionId?: string;
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
  id: string;
  isHead: boolean;
  isOrphaned: boolean;
  isRestorableNow: boolean;
  kind: TransactionKind;
  occurredAt: string;
  parentTransactionId: string | null;
  pointsAfter?: number;
  pointsBefore?: number;
  restoreDisabledReason?: string;
  restoredFromTransactionId?: string;
  restoredToTransactionId?: string;
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
  schemaVersion: 2;
  transactions: TransactionRecord[];
};

export type SharedCommandResult = { ok: true } | { error: string; ok: false };
