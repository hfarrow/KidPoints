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

export type RestoreDescriptor = {
  childId: string;
  target: ChildSnapshot | null;
};

export type TransactionSummaryType =
  | 'child-archived'
  | 'child-created'
  | 'child-deleted'
  | 'child-restored'
  | 'points-adjusted'
  | 'points-set';

export type TransactionRow = {
  childId: string;
  childName: string | null;
  delta?: number;
  eventIds: string[];
  id: string;
  occurredAtEnd: string;
  occurredAtStart: string;
  restoreDescriptor: RestoreDescriptor;
  setPoints?: number;
  summaryType: TransactionSummaryType;
};

export type SharedDocument = {
  deviceId: string;
  events: SharedEvent[];
  head: SharedHead;
  nextSequence: number;
  schemaVersion: 1;
};

export type SharedCommandResult = { ok: true } | { error: string; ok: false };
