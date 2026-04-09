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
  SharedEvent,
  SharedHead,
  SharedTimerConfig,
  SharedTimerState,
  TransactionFilterChild,
  TransactionKind,
  TransactionRecord,
  TransactionRow,
} from './sharedTypes';
import { useStableStoreReference } from './useStableStoreReference';

type SharedStoreState = {
  addChild: (name: string) => SharedCommandResult;
  adjustPoints: (childId: string, delta: number) => SharedCommandResult;
  archiveChild: (childId: string) => SharedCommandResult;
  deleteChildPermanently: (childId: string) => SharedCommandResult;
  document: SharedDocument;
  pauseTimer: () => SharedCommandResult;
  recordParentModeLocked: () => SharedCommandResult;
  recordParentUnlockAttempt: (success: boolean) => SharedCommandResult;
  resetTimer: () => SharedCommandResult;
  resolveCheckInSession: (awardedChildIds: string[]) => SharedCommandResult;
  restoreChild: (childId: string) => SharedCommandResult;
  restoreTransaction: (transactionId: string) => SharedCommandResult;
  setPoints: (childId: string, points: number) => SharedCommandResult;
  startTimer: () => SharedCommandResult;
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
    timerConfig: normalizeTimerConfig(head?.timerConfig),
    timerState: normalizeTimerState(head?.timerState),
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
    schemaVersion: 3,
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
  transaction: TransactionRecord,
): TransactionRecord {
  return {
    ...transaction,
    affectedChildIds: [...transaction.affectedChildIds],
    eventIds: [...transaction.eventIds],
    isRestorable: transaction.isRestorable ?? true,
    participatesInHistory: transaction.participatesInHistory ?? true,
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
    (candidate.schemaVersion === 2 || candidate.schemaVersion === 3) &&
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
  const transactions = document.transactions.map(normalizeTransactionRecord);
  const fallbackHeadTransactionId =
    findLatestHistoryTransaction(transactions)?.id ?? null;
  const currentHeadTransactionId = transactions.some(
    (transaction) =>
      transaction.id === document.currentHeadTransactionId &&
      transaction.participatesInHistory,
  )
    ? document.currentHeadTransactionId
    : fallbackHeadTransactionId;

  return {
    currentHeadTransactionId,
    deviceId: document.deviceId,
    events,
    head: getHeadForCurrentTransaction(transactions, currentHeadTransactionId),
    isOrphanedRestoreWindowOpen: Boolean(document.isOrphanedRestoreWindowOpen),
    nextSequence: document.nextSequence ?? deriveNextSequence(events),
    schemaVersion: 3,
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
  isRestorable?: boolean;
  kind: TransactionKind;
  occurredAt: string;
  parentTransactionId: string | null;
  participatesInHistory?: boolean;
  pointsAfter?: number;
  pointsBefore?: number;
  restoredFromTransactionId?: string;
  restoredToTransactionId?: string;
  stateAfter: SharedHead;
  transactionId?: string;
}) {
  const {
    affectedChildIds,
    childAfter,
    childBefore,
    childId,
    eventIds,
    isRestorable = true,
    kind,
    occurredAt,
    parentTransactionId,
    participatesInHistory = true,
    pointsAfter,
    pointsBefore,
    restoredFromTransactionId,
    restoredToTransactionId,
    stateAfter,
    transactionId,
  } = args;

  return {
    affectedChildIds,
    childId,
    childName: childAfter?.name ?? childBefore?.name ?? null,
    eventIds,
    id: transactionId ?? `tx-${eventIds[0] ?? generateId('transaction')}`,
    isRestorable,
    kind,
    occurredAt,
    parentTransactionId,
    participatesInHistory,
    pointsAfter,
    pointsBefore,
    restoredFromTransactionId,
    restoredToTransactionId,
    stateAfter: cloneHead(stateAfter),
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

  if (
    leftIds.length !== rightIds.length ||
    left.activeChildIds.join('|') !== right.activeChildIds.join('|') ||
    left.archivedChildIds.join('|') !== right.archivedChildIds.join('|') ||
    !areTimerConfigsEquivalent(left.timerConfig, right.timerConfig) ||
    !areTimerStatesEquivalent(left.timerState, right.timerState)
  ) {
    return false;
  }

  return leftIds.every((childId) =>
    areChildrenEquivalent(
      left.childrenById[childId],
      right.childrenById[childId],
    ),
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
      id: transaction.id,
      isHead,
      isOrphaned,
      isRestorable: transaction.isRestorable,
      isRestorableNow,
      kind: transaction.kind,
      occurredAt: transaction.occurredAt,
      parentTransactionId: transaction.parentTransactionId,
      participatesInHistory: transaction.participatesInHistory,
      pointsAfter: transaction.pointsAfter,
      pointsBefore: transaction.pointsBefore,
      restoreDisabledReason,
      restoredFromTransactionId: transaction.restoredFromTransactionId,
      restoredToTransactionId: transaction.restoredToTransactionId,
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

/**
 * Houses the command-style shared store API. Each action validates intent,
 * shapes any resulting events/transactions, and commits them through the
 * history model in one place.
 */
function createSharedStoreActions(
  set: (updater: (state: SharedStoreState) => SharedStoreState) => void,
) {
  return {
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
    resolveCheckInSession(awardedChildIds: string[]): SharedCommandResult {
      const uniqueAwardedChildIds = [...new Set(awardedChildIds)];

      if (uniqueAwardedChildIds.length === 0) {
        return { ok: true };
      }

      let result: SharedCommandResult = { ok: true };

      set((state) => {
        const childSnapshotsBefore = new Map<string, ChildSnapshot>();

        for (const childId of uniqueAwardedChildIds) {
          const child = getChild(state.document.head, childId);

          if (!child || child.status !== 'active') {
            logRejectedSharedStoreMutation(
              'resolveCheckInSession',
              'Only active children can receive check-in awards.',
              {
                awardedChildIds: uniqueAwardedChildIds,
                childId,
              },
            );
            result = {
              error: 'Only active children can receive check-in awards.',
              ok: false,
            };
            return state;
          }

          childSnapshotsBefore.set(childId, child);
        }

        const occurredAt = new Date().toISOString();
        const builder = createEventBuilder(state.document);
        const events: SharedEvent[] = [];
        let nextHead = cloneHead(state.document.head);

        for (const childId of uniqueAwardedChildIds) {
          const event = builder.build(
            'child.pointsAdjusted',
            {
              childId,
              delta: 1,
            },
            occurredAt,
          );

          events.push(event);
          nextHead = applySharedEvent(nextHead, event);
        }

        const primaryChildId =
          uniqueAwardedChildIds.length === 1 ? uniqueAwardedChildIds[0] : null;
        const primaryChildBefore = primaryChildId
          ? (childSnapshotsBefore.get(primaryChildId) ?? null)
          : null;
        const primaryChildAfter = primaryChildId
          ? getChild(nextHead, primaryChildId)
          : null;
        const transaction = createTransactionRecord({
          affectedChildIds: uniqueAwardedChildIds,
          childAfter: primaryChildAfter,
          childBefore: primaryChildBefore,
          childId: primaryChildId,
          eventIds: events.map((event) => event.eventId),
          kind: 'check-in-resolved',
          occurredAt,
          parentTransactionId: state.document.currentHeadTransactionId,
          pointsAfter: primaryChildAfter?.points,
          pointsBefore: primaryChildBefore?.points,
          stateAfter: nextHead,
        });

        logSharedStoreMutation('resolveCheckInSession', {
          awardedChildIds: uniqueAwardedChildIds,
          eventCount: events.length,
          transactionId: transaction.id,
        });
        logSharedTransaction(transaction, {
          awardedChildIds: uniqueAwardedChildIds,
          eventCount: events.length,
        });

        return {
          ...state,
          document: commitDocumentChange({
            document: state.document,
            eventsToAppend: events,
            isOrphanedRestoreWindowOpen: false,
            nextHead,
            transaction,
          }),
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
          kind: 'timer-paused',
          occurredAt,
          parentTransactionId: state.document.currentHeadTransactionId,
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
          kind: 'timer-reset',
          occurredAt,
          parentTransactionId: state.document.currentHeadTransactionId,
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
        const { affectedChildIds, eventsToAppend } = buildRestoreEvents(
          state.document,
          transactionRow.stateAfter,
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
          parentTransactionId: transactionRow.id,
          restoredFromTransactionId:
            state.document.currentHeadTransactionId ?? undefined,
          restoredToTransactionId: transactionRow.id,
          stateAfter: transactionRow.stateAfter,
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
            nextHead: transactionRow.stateAfter,
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
          kind: 'timer-started',
          occurredAt,
          parentTransactionId: state.document.currentHeadTransactionId,
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
