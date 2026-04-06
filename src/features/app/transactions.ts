import Constants from 'expo-constants';

import {
  appDataReducer,
  createChildProfile,
  createDefaultAppData,
} from './state';
import type { ChildProfile, PersistedAppData, SharedTimerState } from './types';

export type TransactionStatus = 'applied' | 'reverted';
export type TransactionUndoPolicy = 'reversible' | 'tracked_only';
export type TransactionEntityRef = string;
export type TransactionEntryKind = 'action' | 'revert' | 'restore';

export type TransactionActionMutation =
  | {
      type: 'child-points-adjusted';
      childId: string;
      childName: string;
      delta: number;
      nextPoints: number;
      previousPoints: number;
      source: 'tap' | 'set';
    }
  | {
      type: 'child-added';
      child: ChildProfile;
    }
  | {
      type: 'child-archived';
      childId: string;
      childName: string;
      previousSortOrder: number;
      archivedAt: number;
    }
  | {
      type: 'child-restored';
      childId: string;
      childName: string;
      restoredSortOrder: number;
      archivedAt: number | null;
    }
  | {
      type: 'child-renamed';
      childId: string;
      previousName: string;
      nextName: string;
    }
  | {
      type: 'child-moved';
      childId: string;
      childName: string;
      direction: 'up' | 'down';
      fromSortOrder: number;
      toSortOrder: number;
    }
  | {
      type: 'child-deleted-permanently';
      child: ChildProfile;
    }
  | {
      type: 'timer-started';
      startedAt: number;
      nextTimerState: SharedTimerState;
    }
  | {
      type: 'timer-paused';
      pausedAt: number;
      previousTimerState: SharedTimerState;
      nextTimerState: SharedTimerState;
    }
  | {
      type: 'timer-reset';
      previousTimerState: SharedTimerState;
      nextTimerState: SharedTimerState;
    };

export type TransactionControlMutation =
  | {
      type: 'revert-threads';
      targetThreadIds: string[];
    }
  | {
      type: 'restore-threads';
      targetThreadIds: string[];
    };

export type TransactionMutation =
  | TransactionActionMutation
  | TransactionControlMutation;

export type TransactionEvent = {
  eventId: string;
  eventHash: string;
  threadId: string;
  deviceId: string;
  deviceSequence: number;
  eventKind: TransactionEntryKind;
  occurredAt: number;
  actorDeviceName: string;
  undoPolicy: TransactionUndoPolicy;
  entityRefs: TransactionEntityRef[];
  dependsOnThreadIds: string[];
  mutation: TransactionMutation;
};

export type TransactionActivityEntry = {
  actorDeviceName: string;
  eventId: string;
  kind: Exclude<TransactionEntryKind, 'action'>;
  occurredAt: number;
};

export type TransactionRecord = {
  id: number;
  threadId: string;
  rootEventId: string;
  kind: TransactionActionMutation['type'];
  occurredAt: number;
  actorDeviceName: string;
  status: TransactionStatus;
  undoPolicy: TransactionUndoPolicy;
  entityRefs: TransactionEntityRef[];
  dependsOnThreadIds: string[];
  forward: TransactionActionMutation;
  activity: TransactionActivityEntry[];
  explicitStatus: TransactionStatus;
  latestControlTargetThreadIds: string[];
  supersededByThreadId: string | null;
};

export type TransactionClientState = {
  deviceId: string;
  nextDeviceSequence: number;
};

export type TransactionSyncSnapshot = {
  canonicalHash: string;
  events: TransactionEvent[];
  headHash: string;
};

export type TransactionState = {
  canonicalHash: string;
  clientState: TransactionClientState;
  events: TransactionEvent[];
  headHash: string;
  transactions: TransactionRecord[];
};

export type PersistedAppDocument = {
  version: 4;
  head: PersistedAppData;
  transactionState: TransactionState;
};

export type SharedTransactionIntent =
  | { type: 'addChild'; name: string }
  | { type: 'renameChild'; childId: string; name: string }
  | { type: 'archiveChild'; childId: string; archivedAt: number }
  | { type: 'restoreChild'; childId: string }
  | { type: 'deleteChildPermanently'; childId: string }
  | { type: 'moveChild'; childId: string; direction: 'up' | 'down' }
  | { type: 'incrementPoints'; childId: string; amount: number }
  | { type: 'decrementPoints'; childId: string; amount: number }
  | { type: 'setPoints'; childId: string; points: number }
  | { type: 'startTimer'; startedAt: number }
  | { type: 'pauseTimer'; pausedAt: number }
  | { type: 'resetTimer' };

export type RevertPlan = {
  target: TransactionRecord | null;
  transactionIds: string[];
};

export type ReconciliationResult = {
  canonicalHashMismatches: string[];
  document: PersistedAppDocument;
};

type LegacyTransactionMutation =
  | TransactionActionMutation
  | {
      type: 'revert-chain';
      targetRootTransactionIds?: number[];
      targetTransactionIds?: number[];
    }
  | {
      type: 'restore-chain';
      targetRootTransactionIds?: number[];
      targetTransactionIds?: number[];
    }
  | {
      type: 'reapply-transactions';
      targetTransactionIds: number[];
    };

type LegacyTransactionRecord = {
  actorDeviceName: string;
  dependsOnTransactionIds: number[];
  entityRefs: TransactionEntityRef[];
  forward: LegacyTransactionMutation;
  id: number;
  occurredAt: number;
  rootTransactionId?: number;
  undoPolicy: TransactionUndoPolicy;
};

type LegacyTransactionState = {
  nextTransactionId: number;
  transactions: LegacyTransactionRecord[];
};

type ThreadAccumulator = {
  actionEvents: TransactionEvent[];
  activity: TransactionActivityEntry[];
  actorDeviceName: string;
  dependsOnThreadIds: string[];
  entityRefs: TransactionEntityRef[];
  explicitStatus: TransactionStatus;
  latestControlTargetThreadIds: string[];
  occurredAt: number;
  rootEventId: string;
  threadId: string;
  undoPolicy: TransactionUndoPolicy;
};

type ThreadProjectionDraft = {
  activity: TransactionActivityEntry[];
  actorDeviceName: string;
  dependsOnThreadIds: string[];
  entityRefs: TransactionEntityRef[];
  explicitStatus: TransactionStatus;
  forward: TransactionActionMutation;
  id: number;
  kind: TransactionActionMutation['type'];
  latestControlTargetThreadIds: string[];
  occurredAt: number;
  rootEventId: string;
  status: TransactionStatus;
  threadId: string;
  undoPolicy: TransactionUndoPolicy;
};

type ActionDraft = {
  dependsOnThreadIds: string[];
  entityRefs: TransactionEntityRef[];
  mutation: TransactionActionMutation;
  threadId?: string;
  undoPolicy: TransactionUndoPolicy;
};

const DOCUMENT_VERSION = 4;
const UNKNOWN_DEVICE_NAME = 'Unknown device';
const VALUE_CHANGE_ARROW = '\u2192';

export function createEmptyTransactionState(
  deviceId = createDeviceId(),
): TransactionState {
  return {
    canonicalHash: hashString(''),
    clientState: {
      deviceId,
      nextDeviceSequence: 1,
    },
    events: [],
    headHash: hashSharedHead(createDefaultAppData()),
    transactions: [],
  };
}

export function createDefaultAppDocument(): PersistedAppDocument {
  const head = createDefaultAppData();

  return {
    version: DOCUMENT_VERSION,
    head,
    transactionState: {
      ...createEmptyTransactionState(),
      headHash: hashSharedHead(head),
    },
  };
}

export function getTransactionActorDeviceName() {
  return Constants.deviceName?.trim() || UNKNOWN_DEVICE_NAME;
}

export function createTransactionSyncSnapshot(
  transactionState: TransactionState,
): TransactionSyncSnapshot {
  return {
    canonicalHash: transactionState.canonicalHash,
    events: [...transactionState.events],
    headHash: transactionState.headHash,
  };
}

export function isPersistedAppDocument(
  value: unknown,
): value is PersistedAppDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedAppDocument>;

  return (
    candidate.version === DOCUMENT_VERSION &&
    typeof candidate.head === 'object' &&
    !!candidate.head &&
    typeof candidate.transactionState === 'object' &&
    !!candidate.transactionState &&
    typeof candidate.transactionState.clientState === 'object' &&
    !!candidate.transactionState.clientState &&
    typeof candidate.transactionState.clientState.deviceId === 'string' &&
    typeof candidate.transactionState.clientState.nextDeviceSequence ===
      'number' &&
    Array.isArray(candidate.transactionState.events)
  );
}

export function coercePersistedAppDocument(
  value: unknown,
): PersistedAppDocument | null {
  if (isPersistedAppDocument(value)) {
    const rebuiltDocument = rebuildDocument({
      ...value,
      transactionState: {
        ...value.transactionState,
        clientState: {
          deviceId:
            value.transactionState.clientState.deviceId || createDeviceId(),
          nextDeviceSequence: Math.max(
            value.transactionState.clientState.nextDeviceSequence,
            1,
          ),
        },
      },
    });

    return preserveAuthoritativeAlarmState(rebuiltDocument, value.head);
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    head?: PersistedAppData;
    transactionState?: LegacyTransactionState;
  };

  if (
    typeof candidate.head !== 'object' ||
    !candidate.head ||
    typeof candidate.transactionState !== 'object' ||
    !candidate.transactionState ||
    !Array.isArray(candidate.transactionState.transactions)
  ) {
    return null;
  }

  const rebuiltDocument = rebuildDocument({
    version: DOCUMENT_VERSION,
    head: candidate.head,
    transactionState: {
      canonicalHash: hashString(''),
      clientState: {
        deviceId: createDeviceId(),
        nextDeviceSequence: 1,
      },
      events: convertLegacyTransactionsToEvents(
        candidate.transactionState.transactions,
      ),
      headHash: hashSharedHead(candidate.head),
      transactions: [],
    },
  });

  return preserveAuthoritativeAlarmState(rebuiltDocument, candidate.head);
}

export function commitSharedTransaction(
  document: PersistedAppDocument,
  intent: SharedTransactionIntent,
  meta: {
    actorDeviceName?: string;
    occurredAt?: number;
  } = {},
): PersistedAppDocument {
  const actorDeviceName =
    meta.actorDeviceName ?? getTransactionActorDeviceName();
  const occurredAt = meta.occurredAt ?? Date.now();

  switch (intent.type) {
    case 'addChild':
      return appendActionEvent(
        document,
        buildAddChildAction(document, intent.name),
        actorDeviceName,
        occurredAt,
      );
    case 'renameChild':
      return appendActionEvent(
        document,
        buildRenameChildAction(document, intent.childId, intent.name),
        actorDeviceName,
        occurredAt,
      );
    case 'archiveChild':
      return appendActionEvent(
        document,
        buildArchiveChildAction(document, intent.childId, intent.archivedAt),
        actorDeviceName,
        occurredAt,
      );
    case 'restoreChild':
      return appendActionEvent(
        document,
        buildRestoreChildAction(document, intent.childId),
        actorDeviceName,
        occurredAt,
      );
    case 'deleteChildPermanently':
      return appendActionEvent(
        document,
        buildDeleteChildAction(document, intent.childId),
        actorDeviceName,
        occurredAt,
      );
    case 'moveChild':
      return appendActionEvent(
        document,
        buildMoveChildAction(document, intent.childId, intent.direction),
        actorDeviceName,
        occurredAt,
      );
    case 'incrementPoints':
      return appendActionEvent(
        document,
        buildPointAdjustmentAction(
          document,
          intent.childId,
          Math.abs(intent.amount),
          'tap',
        ),
        actorDeviceName,
        occurredAt,
      );
    case 'decrementPoints':
      return appendActionEvent(
        document,
        buildPointAdjustmentAction(
          document,
          intent.childId,
          -Math.abs(intent.amount),
          'tap',
        ),
        actorDeviceName,
        occurredAt,
      );
    case 'setPoints':
      return appendActionEvent(
        document,
        buildSetPointsAction(document, intent.childId, intent.points),
        actorDeviceName,
        occurredAt,
      );
    case 'startTimer':
      return appendActionEvent(
        document,
        buildTimerStartAction(document, intent.startedAt),
        actorDeviceName,
        occurredAt,
      );
    case 'pauseTimer':
      return appendActionEvent(
        document,
        buildTimerPauseAction(document, intent.pausedAt),
        actorDeviceName,
        occurredAt,
      );
    case 'resetTimer':
      return appendActionEvent(
        document,
        buildTimerResetAction(document),
        actorDeviceName,
        occurredAt,
      );
    default:
      return document;
  }
}

export function reconcileTransactionDocuments(
  document: PersistedAppDocument,
  snapshots: TransactionSyncSnapshot[],
): ReconciliationResult {
  const canonicalHashMismatches = snapshots
    .filter((snapshot) => {
      const rebuilt = rebuildDocument({
        ...document,
        transactionState: {
          ...document.transactionState,
          events: snapshot.events,
        },
      });

      return (
        rebuilt.transactionState.canonicalHash !== snapshot.canonicalHash ||
        rebuilt.transactionState.headHash !== snapshot.headHash
      );
    })
    .map((snapshot) => snapshot.canonicalHash);

  return {
    canonicalHashMismatches,
    document: rebuildDocument({
      ...document,
      transactionState: {
        ...document.transactionState,
        events: dedupeEvents([
          ...document.transactionState.events,
          ...snapshots.flatMap((snapshot) => snapshot.events),
        ]),
      },
    }),
  };
}

export function getRevertPlan(
  transactionState: TransactionState,
  threadId: string,
): RevertPlan {
  const target =
    transactionState.transactions.find(
      (transaction) => transaction.threadId === threadId,
    ) ?? null;

  if (!target || !canRevertTransaction(target)) {
    return {
      target,
      transactionIds: [],
    };
  }

  const transactionIds = new Set<string>([target.threadId]);

  for (const transaction of transactionState.transactions) {
    if (
      transaction.status === 'applied' &&
      transaction.dependsOnThreadIds.some((dependencyThreadId) =>
        transactionIds.has(dependencyThreadId),
      )
    ) {
      transactionIds.add(transaction.threadId);
    }
  }

  return {
    target,
    transactionIds: sortThreadIdsForDisplay(
      [...transactionIds],
      transactionState.transactions,
    ),
  };
}

export function getRestorePlan(
  transactionState: TransactionState,
  threadId: string,
): RevertPlan {
  const target =
    transactionState.transactions.find(
      (transaction) => transaction.threadId === threadId,
    ) ?? null;

  if (!target || !canRestoreTransaction(target)) {
    return {
      target,
      transactionIds: [],
    };
  }

  const transactionIds = new Set<string>();
  const transactionByThreadId = new Map(
    transactionState.transactions.map((transaction) => [
      transaction.threadId,
      transaction,
    ]),
  );
  const collectRevertedDependencies = (dependencyThreadId: string) => {
    const dependency = transactionByThreadId.get(dependencyThreadId);

    if (!dependency || transactionIds.has(dependencyThreadId)) {
      return;
    }

    if (dependency.status !== 'reverted') {
      return;
    }

    transactionIds.add(dependencyThreadId);

    for (const nestedDependencyThreadId of dependency.dependsOnThreadIds) {
      collectRevertedDependencies(nestedDependencyThreadId);
    }
  };

  transactionIds.add(target.threadId);

  for (const dependencyThreadId of target.dependsOnThreadIds) {
    collectRevertedDependencies(dependencyThreadId);
  }

  return {
    target,
    transactionIds: sortThreadIdsForDisplay(
      [...transactionIds],
      transactionState.transactions,
    ),
  };
}

export function revertTransaction(
  document: PersistedAppDocument,
  threadId: string,
  meta: {
    actorDeviceName?: string;
    occurredAt?: number;
  } = {},
): PersistedAppDocument {
  const plan = getRevertPlan(document.transactionState, threadId);

  if (!plan.target || plan.transactionIds.length === 0) {
    return document;
  }

  return appendControlEvent(
    document,
    'revert',
    {
      type: 'revert-threads',
      targetThreadIds: plan.transactionIds,
    },
    meta.actorDeviceName ?? getTransactionActorDeviceName(),
    meta.occurredAt ?? Date.now(),
    [
      ...new Set(
        plan.transactionIds.flatMap(
          (targetThreadId) =>
            document.transactionState.transactions.find(
              (transaction) => transaction.threadId === targetThreadId,
            )?.entityRefs ?? [],
        ),
      ),
    ],
  );
}

export function restoreTransaction(
  document: PersistedAppDocument,
  threadId: string,
  meta: {
    actorDeviceName?: string;
    occurredAt?: number;
  } = {},
): PersistedAppDocument {
  const plan = getRestorePlan(document.transactionState, threadId);

  if (!plan.target || plan.transactionIds.length === 0) {
    return document;
  }

  return appendControlEvent(
    document,
    'restore',
    {
      type: 'restore-threads',
      targetThreadIds: plan.transactionIds,
    },
    meta.actorDeviceName ?? getTransactionActorDeviceName(),
    meta.occurredAt ?? Date.now(),
    [
      ...new Set(
        plan.transactionIds.flatMap(
          (targetThreadId) =>
            document.transactionState.transactions.find(
              (transaction) => transaction.threadId === targetThreadId,
            )?.entityRefs ?? [],
        ),
      ),
    ],
  );
}

export function canRevertTransaction(transaction: TransactionRecord) {
  return (
    transaction.undoPolicy === 'reversible' &&
    transaction.status === 'applied' &&
    transaction.supersededByThreadId === null
  );
}

export function canRestoreTransaction(transaction: TransactionRecord) {
  return (
    transaction.undoPolicy === 'reversible' &&
    transaction.status === 'reverted' &&
    transaction.explicitStatus === 'reverted' &&
    transaction.supersededByThreadId === null
  );
}

export function isVisibleTransaction(_transaction: TransactionRecord) {
  return true;
}

export function getVisibleTransactions(transactions: TransactionRecord[]) {
  return transactions.filter(isVisibleTransaction);
}

export function getTransactionActivityEntries(transaction: TransactionRecord) {
  return transaction.activity;
}

export function getTransactionSummary(
  transaction: TransactionRecord,
  _transactions: TransactionRecord[] = [],
): string {
  switch (transaction.forward.type) {
    case 'child-points-adjusted': {
      const verb = transaction.forward.delta >= 0 ? '+' : '-';

      return `${transaction.forward.childName} ${verb}${Math.abs(transaction.forward.delta)} points (${transaction.forward.previousPoints} ${VALUE_CHANGE_ARROW} ${transaction.forward.nextPoints})`;
    }
    case 'child-added':
      return `Added ${transaction.forward.child.displayName}`;
    case 'child-archived':
      return `Archived ${transaction.forward.childName}`;
    case 'child-restored':
      return `Restored ${transaction.forward.childName}`;
    case 'child-renamed':
      return `${transaction.forward.previousName} renamed to ${transaction.forward.nextName}`;
    case 'child-moved':
      return `Reordered ${transaction.forward.childName}`;
    case 'child-deleted-permanently':
      return `Deleted ${transaction.forward.child.displayName}`;
    case 'timer-started':
      return 'Started timer';
    case 'timer-paused':
      return 'Paused timer';
    case 'timer-reset':
      return 'Reset timer';
    default:
      return 'Transaction';
  }
}

export function getTransactionDetail(transaction: TransactionRecord) {
  switch (transaction.forward.type) {
    case 'child-points-adjusted':
      return `${transaction.forward.previousPoints} ${VALUE_CHANGE_ARROW} ${transaction.forward.nextPoints}`;
    default:
      return null;
  }
}

function appendActionEvent(
  document: PersistedAppDocument,
  draft: ActionDraft | null,
  actorDeviceName: string,
  occurredAt: number,
) {
  if (!draft) {
    return document;
  }

  const { event, nextClientState } = createEvent(document.transactionState, {
    actorDeviceName,
    ...draft,
    eventKind: 'action',
    occurredAt,
  });

  return rebuildDocument({
    ...document,
    transactionState: {
      ...document.transactionState,
      clientState: nextClientState,
      events: [...document.transactionState.events, event],
    },
  });
}

function appendControlEvent(
  document: PersistedAppDocument,
  eventKind: Exclude<TransactionEntryKind, 'action'>,
  mutation: TransactionControlMutation,
  actorDeviceName: string,
  occurredAt: number,
  entityRefs: TransactionEntityRef[],
) {
  const { event, nextClientState } = createEvent(document.transactionState, {
    actorDeviceName,
    dependsOnThreadIds: mutation.targetThreadIds,
    entityRefs,
    eventKind,
    mutation,
    occurredAt,
    undoPolicy: 'tracked_only',
  });

  return rebuildDocument({
    ...document,
    transactionState: {
      ...document.transactionState,
      clientState: nextClientState,
      events: [...document.transactionState.events, event],
    },
  });
}

function createEvent(
  transactionState: TransactionState,
  input: {
    actorDeviceName: string;
    dependsOnThreadIds: string[];
    entityRefs: TransactionEntityRef[];
    eventKind: TransactionEntryKind;
    mutation: TransactionMutation;
    occurredAt: number;
    threadId?: string;
    undoPolicy: TransactionUndoPolicy;
  },
) {
  const deviceId = transactionState.clientState.deviceId;
  const deviceSequence = transactionState.clientState.nextDeviceSequence;
  const eventId = createEventId(deviceId, deviceSequence);
  const event: Omit<TransactionEvent, 'eventHash'> = {
    actorDeviceName: input.actorDeviceName,
    dependsOnThreadIds: [...input.dependsOnThreadIds],
    deviceId,
    deviceSequence,
    entityRefs: [...input.entityRefs],
    eventId,
    eventKind: input.eventKind,
    mutation: input.mutation,
    occurredAt: input.occurredAt,
    threadId: input.threadId ?? createThreadId(deviceId, deviceSequence),
    undoPolicy: input.undoPolicy,
  };

  return {
    event: withEventHash(event),
    nextClientState: {
      ...transactionState.clientState,
      nextDeviceSequence: deviceSequence + 1,
    },
  };
}

function rebuildDocument(document: PersistedAppDocument): PersistedAppDocument {
  const rebuilt = rebuildState(
    document.head,
    document.transactionState.clientState,
    document.transactionState.events,
  );

  return {
    ...document,
    version: DOCUMENT_VERSION,
    head: rebuilt.head,
    transactionState: rebuilt.transactionState,
  };
}

function preserveAuthoritativeAlarmState(
  document: PersistedAppDocument,
  persistedHead: PersistedAppData,
): PersistedAppDocument {
  const nextHead = {
    ...document.head,
    expiredIntervals: persistedHead.expiredIntervals,
    timerRuntimeState: persistedHead.timerRuntimeState,
    timerState: persistedHead.timerState,
  };

  return {
    ...document,
    head: nextHead,
    transactionState: {
      ...document.transactionState,
      headHash: hashSharedHead(nextHead),
    },
  };
}

function rebuildState(
  currentHead: PersistedAppData,
  clientState: TransactionClientState,
  events: TransactionEvent[],
) {
  const dedupedEvents = dedupeEvents(events);

  if (dedupedEvents.length === 0) {
    return {
      head: currentHead,
      transactionState: {
        canonicalHash: hashString(''),
        clientState,
        events: [],
        headHash: hashSharedHead(currentHead),
        transactions: [],
      } satisfies TransactionState,
    };
  }

  const orderedEvents = orderEvents(dedupedEvents);
  const canonicalHash = hashString(
    orderedEvents
      .map((event) => `${event.eventId}:${event.eventHash}`)
      .join('|'),
  );
  const threadMap = new Map<string, ThreadAccumulator>();

  for (const event of orderedEvents) {
    if (event.eventKind === 'action') {
      const existing = threadMap.get(event.threadId);

      if (existing) {
        existing.actionEvents.push(event);
        existing.entityRefs = [
          ...new Set([...existing.entityRefs, ...event.entityRefs]),
        ];
        continue;
      }

      if (!isActionMutation(event.mutation)) {
        continue;
      }

      threadMap.set(event.threadId, {
        actionEvents: [event],
        activity: [],
        actorDeviceName: event.actorDeviceName,
        dependsOnThreadIds: [...event.dependsOnThreadIds],
        entityRefs: [...event.entityRefs],
        explicitStatus: 'applied',
        latestControlTargetThreadIds: [event.threadId],
        occurredAt: event.occurredAt,
        rootEventId: event.eventId,
        threadId: event.threadId,
        undoPolicy: event.undoPolicy,
      });

      continue;
    }

    if (!isControlMutation(event.mutation)) {
      continue;
    }

    for (const targetThreadId of event.mutation.targetThreadIds) {
      const thread = threadMap.get(targetThreadId);

      if (!thread) {
        continue;
      }

      thread.activity.push({
        actorDeviceName: event.actorDeviceName,
        eventId: event.eventId,
        kind: event.eventKind,
        occurredAt: event.occurredAt,
      });
      thread.explicitStatus =
        event.eventKind === 'revert' ? 'reverted' : 'applied';
      thread.latestControlTargetThreadIds = [...event.mutation.targetThreadIds];
    }
  }

  const threadStatusCache = new Map<string, TransactionStatus>();
  const isThreadApplied = (
    threadId: string,
    visiting = new Set<string>(),
  ): boolean => {
    const cached = threadStatusCache.get(threadId);

    if (cached) {
      return cached === 'applied';
    }

    const thread = threadMap.get(threadId);

    if (!thread || visiting.has(threadId)) {
      threadStatusCache.set(threadId, 'reverted');
      return false;
    }

    visiting.add(threadId);
    const applied =
      thread.explicitStatus === 'applied' &&
      thread.dependsOnThreadIds.every((dependencyThreadId) =>
        isThreadApplied(dependencyThreadId, visiting),
      );
    visiting.delete(threadId);
    threadStatusCache.set(threadId, applied ? 'applied' : 'reverted');

    return applied;
  };
  const baseHead = createProjectionBaseHead(currentHead);
  const nextHead = orderedEvents.reduce((head, event) => {
    if (
      event.eventKind !== 'action' ||
      !isThreadApplied(event.threadId) ||
      !isActionMutation(event.mutation)
    ) {
      return head;
    }

    return applyActionMutation(head, event.mutation);
  }, baseHead);
  const orderedThreads = [...threadMap.values()].sort(
    (left, right) =>
      left.occurredAt - right.occurredAt ||
      left.rootEventId.localeCompare(right.rootEventId),
  );
  const threadProjectionDrafts: ThreadProjectionDraft[] = orderedThreads.map(
    (thread, index) => {
      const forward = aggregateThreadMutation(thread.actionEvents);

      return {
        activity: [...thread.activity].sort(
          (left, right) =>
            left.occurredAt - right.occurredAt ||
            left.eventId.localeCompare(right.eventId),
        ),
        actorDeviceName: thread.actorDeviceName,
        dependsOnThreadIds: [...thread.dependsOnThreadIds],
        entityRefs: [...thread.entityRefs],
        explicitStatus: thread.explicitStatus,
        forward,
        id: index + 1,
        kind: forward.type,
        latestControlTargetThreadIds: [...thread.latestControlTargetThreadIds],
        occurredAt: thread.occurredAt,
        rootEventId: thread.rootEventId,
        status: isThreadApplied(thread.threadId) ? 'applied' : 'reverted',
        threadId: thread.threadId,
        undoPolicy: thread.undoPolicy,
      };
    },
  );
  const supersededByThreadIdByThreadId = deriveSupersededThreadIds(
    threadProjectionDrafts,
  );
  const transactions = threadProjectionDrafts.map((thread) => {
    return {
      activity: [...thread.activity],
      actorDeviceName: thread.actorDeviceName,
      dependsOnThreadIds: [...thread.dependsOnThreadIds],
      entityRefs: [...thread.entityRefs],
      explicitStatus: thread.explicitStatus,
      forward: thread.forward,
      id: thread.id,
      kind: thread.kind,
      latestControlTargetThreadIds: [...thread.latestControlTargetThreadIds],
      occurredAt: thread.occurredAt,
      rootEventId: thread.rootEventId,
      status: thread.status,
      supersededByThreadId:
        supersededByThreadIdByThreadId.get(thread.threadId) ?? null,
      threadId: thread.threadId,
      undoPolicy: thread.undoPolicy,
    } satisfies TransactionRecord;
  });

  return {
    head: nextHead,
    transactionState: {
      canonicalHash,
      clientState,
      events: orderedEvents,
      headHash: hashSharedHead(nextHead),
      transactions,
    } satisfies TransactionState,
  };
}

function buildAddChildAction(
  document: PersistedAppDocument,
  name: string,
): ActionDraft | null {
  if (!name.trim()) {
    return null;
  }

  const child = createChildProfile(document.head.children, name);

  return {
    dependsOnThreadIds: [],
    entityRefs: createChildEntityRefs(child.id, true),
    mutation: {
      type: 'child-added',
      child,
    },
    undoPolicy: 'reversible',
  };
}

function buildRenameChildAction(
  document: PersistedAppDocument,
  childId: string,
  nextName: string,
): ActionDraft | null {
  const child = document.head.children.find(
    (candidate) => candidate.id === childId,
  );
  const trimmedName = nextName.trim();

  if (!child || !trimmedName || child.displayName === trimmedName) {
    return null;
  }

  return {
    dependsOnThreadIds: getChildLifecycleDependencies(
      document.transactionState,
      childId,
    ),
    entityRefs: createChildEntityRefs(childId),
    mutation: {
      type: 'child-renamed',
      childId,
      nextName: trimmedName,
      previousName: child.displayName,
    },
    undoPolicy: 'tracked_only',
  };
}

function buildArchiveChildAction(
  document: PersistedAppDocument,
  childId: string,
  archivedAt: number,
): ActionDraft | null {
  const child = document.head.children.find(
    (candidate) => candidate.id === childId && !candidate.isArchived,
  );

  if (!child) {
    return null;
  }

  return {
    dependsOnThreadIds: getChildLifecycleDependencies(
      document.transactionState,
      childId,
    ),
    entityRefs: createChildEntityRefs(childId, true),
    mutation: {
      type: 'child-archived',
      archivedAt,
      childId,
      childName: child.displayName,
      previousSortOrder: child.sortOrder,
    },
    undoPolicy: 'reversible',
  };
}

function buildRestoreChildAction(
  document: PersistedAppDocument,
  childId: string,
): ActionDraft | null {
  const child = document.head.children.find(
    (candidate) => candidate.id === childId && candidate.isArchived,
  );

  if (!child) {
    return null;
  }

  const restoredSortOrder = document.head.children.filter(
    (candidate) => !candidate.isArchived,
  ).length;

  return {
    dependsOnThreadIds: getChildLifecycleDependencies(
      document.transactionState,
      childId,
    ),
    entityRefs: createChildEntityRefs(childId, true),
    mutation: {
      type: 'child-restored',
      archivedAt: child.archivedAt,
      childId,
      childName: child.displayName,
      restoredSortOrder,
    },
    undoPolicy: 'reversible',
  };
}

function buildDeleteChildAction(
  document: PersistedAppDocument,
  childId: string,
): ActionDraft | null {
  const child = document.head.children.find(
    (candidate) => candidate.id === childId,
  );

  if (!child) {
    return null;
  }

  return {
    dependsOnThreadIds: getChildLifecycleDependencies(
      document.transactionState,
      childId,
    ),
    entityRefs: createChildEntityRefs(childId, true),
    mutation: {
      type: 'child-deleted-permanently',
      child,
    },
    undoPolicy: 'tracked_only',
  };
}

function buildMoveChildAction(
  document: PersistedAppDocument,
  childId: string,
  direction: 'up' | 'down',
): ActionDraft | null {
  const orderedChildren = [...document.head.children]
    .filter((child) => !child.isArchived)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const currentIndex = orderedChildren.findIndex(
    (child) => child.id === childId,
  );

  if (currentIndex === -1) {
    return null;
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= orderedChildren.length) {
    return null;
  }

  const child = orderedChildren[currentIndex];

  return {
    dependsOnThreadIds: getChildLifecycleDependencies(
      document.transactionState,
      childId,
    ),
    entityRefs: createChildEntityRefs(childId),
    mutation: {
      type: 'child-moved',
      childId,
      childName: child.displayName,
      direction,
      fromSortOrder: child.sortOrder,
      toSortOrder: orderedChildren[targetIndex]?.sortOrder ?? child.sortOrder,
    },
    undoPolicy: 'tracked_only',
  };
}

function buildPointAdjustmentAction(
  document: PersistedAppDocument,
  childId: string,
  delta: number,
  source: 'tap' | 'set',
): ActionDraft | null {
  if (delta === 0) {
    return null;
  }

  const child = document.head.children.find(
    (candidate) => candidate.id === childId && !candidate.isArchived,
  );

  if (!child) {
    return null;
  }

  const nextHead = appDataReducer(document.head, {
    type: 'adjustPoints',
    childId,
    delta,
  });
  const nextChild = nextHead.children.find(
    (candidate) => candidate.id === childId,
  );

  if (!nextChild || nextChild.points === child.points) {
    return null;
  }

  const appliedDelta = nextChild.points - child.points;
  const lastEvent = document.transactionState.events.at(-1);
  const mergedThreadId =
    source === 'tap' &&
    lastEvent &&
    canMergePointEvent(lastEvent, childId, appliedDelta)
      ? lastEvent.threadId
      : undefined;
  const mergedDependsOnThreadIds: string[] | undefined = mergedThreadId
    ? document.transactionState.transactions.find(
        (transaction) => transaction.threadId === mergedThreadId,
      )?.dependsOnThreadIds
    : undefined;

  return {
    dependsOnThreadIds:
      mergedDependsOnThreadIds ??
      getChildLifecycleDependencies(document.transactionState, childId),
    entityRefs: createChildEntityRefs(childId),
    mutation: {
      type: 'child-points-adjusted',
      childId,
      childName: child.displayName,
      delta: appliedDelta,
      nextPoints: nextChild.points,
      previousPoints: child.points,
      source,
    },
    threadId: mergedThreadId,
    undoPolicy: 'reversible',
  };
}

function buildSetPointsAction(
  document: PersistedAppDocument,
  childId: string,
  points: number,
): ActionDraft | null {
  const child = document.head.children.find(
    (candidate) => candidate.id === childId && !candidate.isArchived,
  );

  if (!child) {
    return null;
  }

  const nextHead = appDataReducer(document.head, {
    type: 'setPoints',
    childId,
    points,
  });
  const nextChild = nextHead.children.find(
    (candidate) => candidate.id === childId,
  );

  if (!nextChild || nextChild.points === child.points) {
    return null;
  }

  return buildPointAdjustmentAction(
    document,
    childId,
    nextChild.points - child.points,
    'set',
  );
}

function buildTimerStartAction(
  document: PersistedAppDocument,
  startedAt: number,
): ActionDraft | null {
  const nextHead = appDataReducer(document.head, {
    type: 'startTimer',
    startedAt,
  });

  if (isSameTimerState(document.head.timerState, nextHead.timerState)) {
    return null;
  }

  return {
    dependsOnThreadIds: getTimerDependencies(document.transactionState),
    entityRefs: ['timer:shared'],
    mutation: {
      type: 'timer-started',
      nextTimerState: nextHead.timerState,
      startedAt,
    },
    undoPolicy: 'tracked_only',
  };
}

function buildTimerPauseAction(
  document: PersistedAppDocument,
  pausedAt: number,
): ActionDraft | null {
  const nextHead = appDataReducer(document.head, {
    type: 'pauseTimer',
    pausedAt,
  });

  if (isSameTimerState(document.head.timerState, nextHead.timerState)) {
    return null;
  }

  return {
    dependsOnThreadIds: getTimerDependencies(document.transactionState),
    entityRefs: ['timer:shared'],
    mutation: {
      type: 'timer-paused',
      nextTimerState: nextHead.timerState,
      pausedAt,
      previousTimerState: document.head.timerState,
    },
    undoPolicy: 'tracked_only',
  };
}

function buildTimerResetAction(
  document: PersistedAppDocument,
): ActionDraft | null {
  const nextHead = appDataReducer(document.head, {
    type: 'resetTimer',
  });

  if (isSameTimerState(document.head.timerState, nextHead.timerState)) {
    return null;
  }

  return {
    dependsOnThreadIds: getTimerDependencies(document.transactionState),
    entityRefs: ['timer:shared'],
    mutation: {
      type: 'timer-reset',
      nextTimerState: nextHead.timerState,
      previousTimerState: document.head.timerState,
    },
    undoPolicy: 'tracked_only',
  };
}

function aggregateThreadMutation(actionEvents: TransactionEvent[]) {
  const firstMutation = actionEvents[0]?.mutation;

  if (!firstMutation || !isActionMutation(firstMutation)) {
    throw new Error('Thread is missing an action mutation');
  }

  if (firstMutation.type !== 'child-points-adjusted') {
    return firstMutation;
  }

  const pointMutations = actionEvents
    .map((event) => event.mutation)
    .filter(
      (
        mutation,
      ): mutation is Extract<
        TransactionActionMutation,
        { type: 'child-points-adjusted' }
      > => mutation.type === 'child-points-adjusted',
    );
  const lastMutation = pointMutations.at(-1) ?? firstMutation;

  return {
    ...firstMutation,
    delta: pointMutations.reduce((sum, mutation) => sum + mutation.delta, 0),
    nextPoints: lastMutation.nextPoints,
    previousPoints: firstMutation.previousPoints,
  };
}

function dedupeEvents(events: TransactionEvent[]) {
  const eventMap = new Map<string, TransactionEvent>();

  for (const event of events) {
    if (!eventMap.has(event.eventId)) {
      eventMap.set(event.eventId, event);
    }
  }

  return [...eventMap.values()];
}

function orderEvents(events: TransactionEvent[]) {
  const eventMap = new Map(events.map((event) => [event.eventId, event]));
  const rootEventIdsByThreadId = new Map<string, string>();

  for (const event of events) {
    if (
      event.eventKind === 'action' &&
      !rootEventIdsByThreadId.has(event.threadId)
    ) {
      rootEventIdsByThreadId.set(event.threadId, event.eventId);
    }
  }

  const edges = new Map<string, Set<string>>();
  const indegree = new Map<string, number>(
    events.map((event) => [event.eventId, 0]),
  );
  const eventsByDevice = new Map<string, TransactionEvent[]>();

  for (const event of events) {
    const current = eventsByDevice.get(event.deviceId) ?? [];
    current.push(event);
    eventsByDevice.set(event.deviceId, current);
  }

  for (const deviceEvents of eventsByDevice.values()) {
    deviceEvents.sort(
      (left, right) => left.deviceSequence - right.deviceSequence,
    );

    for (let index = 1; index < deviceEvents.length; index += 1) {
      addEdge(deviceEvents[index - 1]?.eventId, deviceEvents[index]?.eventId);
    }
  }

  for (const event of events) {
    const dependencyThreadIds = isActionMutation(event.mutation)
      ? event.dependsOnThreadIds
      : event.mutation.targetThreadIds;

    for (const dependencyThreadId of dependencyThreadIds) {
      addEdge(rootEventIdsByThreadId.get(dependencyThreadId), event.eventId);
    }
  }

  const ready = [...events]
    .filter((event) => indegree.get(event.eventId) === 0)
    .sort(compareEvents);
  const ordered: TransactionEvent[] = [];

  while (ready.length > 0) {
    const next = ready.shift();

    if (!next) {
      break;
    }

    ordered.push(next);

    for (const childId of edges.get(next.eventId) ?? []) {
      const nextDegree = (indegree.get(childId) ?? 0) - 1;
      indegree.set(childId, nextDegree);

      if (nextDegree === 0) {
        const childEvent = eventMap.get(childId);

        if (childEvent) {
          ready.push(childEvent);
          ready.sort(compareEvents);
        }
      }
    }
  }

  if (ordered.length === events.length) {
    return ordered;
  }

  return [...events].sort(compareEvents);

  function addEdge(fromId?: string, toId?: string) {
    if (!fromId || !toId || fromId === toId) {
      return;
    }

    const nextEdges = edges.get(fromId) ?? new Set<string>();

    if (nextEdges.has(toId)) {
      return;
    }

    nextEdges.add(toId);
    edges.set(fromId, nextEdges);
    indegree.set(toId, (indegree.get(toId) ?? 0) + 1);
  }
}

function compareEvents(left: TransactionEvent, right: TransactionEvent) {
  return left.eventId.localeCompare(right.eventId);
}

function applyActionMutation(
  head: PersistedAppData,
  mutation: TransactionActionMutation,
): PersistedAppData {
  switch (mutation.type) {
    case 'child-points-adjusted':
      return mutation.source === 'set'
        ? appDataReducer(head, {
            type: 'setPoints',
            childId: mutation.childId,
            points: mutation.nextPoints,
          })
        : appDataReducer(head, {
            type: 'adjustPoints',
            childId: mutation.childId,
            delta: mutation.delta,
          });
    case 'child-added':
      return appDataReducer(head, {
        type: 'addChildRecord',
        child: mutation.child,
      });
    case 'child-archived':
      return appDataReducer(head, {
        type: 'archiveChild',
        archivedAt: mutation.archivedAt,
        childId: mutation.childId,
      });
    case 'child-restored':
      return appDataReducer(head, {
        type: 'restoreChildToOrder',
        childId: mutation.childId,
        sortOrder: mutation.restoredSortOrder,
      });
    case 'child-renamed':
      return appDataReducer(head, {
        type: 'renameChild',
        childId: mutation.childId,
        name: mutation.nextName,
      });
    case 'child-moved':
      return appDataReducer(head, {
        type: 'moveChild',
        childId: mutation.childId,
        direction: mutation.direction,
      });
    case 'child-deleted-permanently':
      return appDataReducer(head, {
        type: 'deleteChildPermanently',
        childId: mutation.child.id,
      });
    case 'timer-started':
    case 'timer-paused':
    case 'timer-reset':
      return appDataReducer(head, {
        type: 'replaceTimerState',
        timerState: mutation.nextTimerState,
      });
    default:
      return head;
  }
}

function convertLegacyTransactionsToEvents(
  transactions: LegacyTransactionRecord[],
): TransactionEvent[] {
  const sortedTransactions = [...transactions].sort(
    (left, right) => left.id - right.id,
  );
  const threadIdByLegacyRootId = new Map<number, string>();

  for (const transaction of sortedTransactions) {
    const legacyRootId = transaction.rootTransactionId ?? transaction.id;

    if (!threadIdByLegacyRootId.has(legacyRootId)) {
      threadIdByLegacyRootId.set(legacyRootId, `legacy-thread:${legacyRootId}`);
    }
  }

  return sortedTransactions.flatMap((transaction) => {
    const threadId =
      threadIdByLegacyRootId.get(
        transaction.rootTransactionId ?? transaction.id,
      ) ?? `legacy-thread:${transaction.rootTransactionId ?? transaction.id}`;
    const dependsOnThreadIds = transaction.dependsOnTransactionIds
      .map((legacyId) => {
        const dependency = sortedTransactions.find(
          (candidate) => candidate.id === legacyId,
        );

        if (!dependency) {
          return null;
        }

        return (
          threadIdByLegacyRootId.get(
            dependency.rootTransactionId ?? dependency.id,
          ) ?? null
        );
      })
      .filter((value): value is string => !!value);
    const baseEvent = {
      actorDeviceName: transaction.actorDeviceName,
      dependsOnThreadIds,
      deviceId: 'legacy',
      deviceSequence: transaction.id,
      entityRefs: transaction.entityRefs,
      eventId: `legacy-event:${transaction.id}`,
      occurredAt: transaction.occurredAt,
      threadId,
      undoPolicy: transaction.undoPolicy,
    };

    if (isLegacyActionMutation(transaction.forward)) {
      return [
        withEventHash({
          ...baseEvent,
          eventKind: 'action',
          mutation: transaction.forward,
        }),
      ];
    }

    if (
      transaction.forward.type === 'revert-chain' ||
      transaction.forward.type === 'restore-chain'
    ) {
      const legacyTargets =
        transaction.forward.targetRootTransactionIds ??
        transaction.forward.targetTransactionIds ??
        [];

      return [
        withEventHash({
          ...baseEvent,
          eventKind:
            transaction.forward.type === 'restore-chain' ? 'restore' : 'revert',
          mutation: {
            type:
              transaction.forward.type === 'restore-chain'
                ? 'restore-threads'
                : 'revert-threads',
            targetThreadIds: legacyTargets
              .map((legacyTargetId) =>
                threadIdByLegacyRootId.get(legacyTargetId),
              )
              .filter((value): value is string => !!value),
          },
        }),
      ];
    }

    return [];
  });
}

function withEventHash(
  event: Omit<TransactionEvent, 'eventHash'>,
): TransactionEvent {
  return {
    ...event,
    eventHash: hashString(stableSerialize(event)),
  };
}

function isLegacyActionMutation(
  mutation: LegacyTransactionMutation,
): mutation is TransactionActionMutation {
  return (
    mutation.type !== 'revert-chain' &&
    mutation.type !== 'restore-chain' &&
    mutation.type !== 'reapply-transactions'
  );
}

function isActionMutation(
  mutation: TransactionMutation,
): mutation is TransactionActionMutation {
  return (
    mutation.type !== 'revert-threads' && mutation.type !== 'restore-threads'
  );
}

function isControlMutation(
  mutation: TransactionMutation,
): mutation is TransactionControlMutation {
  return (
    mutation.type === 'revert-threads' || mutation.type === 'restore-threads'
  );
}

function getChildLifecycleDependencies(
  transactionState: TransactionState,
  childId: string,
) {
  const dependency = [...transactionState.transactions]
    .reverse()
    .find(
      (transaction) =>
        transaction.status === 'applied' &&
        transaction.entityRefs.includes(`child-lifecycle:${childId}`),
    );

  return dependency ? [dependency.threadId] : [];
}

function getTimerDependencies(transactionState: TransactionState) {
  const dependency = [...transactionState.transactions]
    .reverse()
    .find(
      (transaction) =>
        transaction.status === 'applied' &&
        transaction.entityRefs.includes('timer:shared'),
    );

  return dependency ? [dependency.threadId] : [];
}

function deriveSupersededThreadIds(transactions: ThreadProjectionDraft[]) {
  const nextThreadIdByLaneKey = new Map<string, string>();
  const supersededByThreadIdByThreadId = new Map<string, string | null>();

  for (let index = transactions.length - 1; index >= 0; index -= 1) {
    const transaction = transactions[index];

    if (!transaction) {
      continue;
    }

    const laneKey = getExclusiveLaneKey(transaction.forward);

    if (!laneKey) {
      supersededByThreadIdByThreadId.set(transaction.threadId, null);
      continue;
    }

    supersededByThreadIdByThreadId.set(
      transaction.threadId,
      nextThreadIdByLaneKey.get(laneKey) ?? null,
    );
    nextThreadIdByLaneKey.set(laneKey, transaction.threadId);
  }

  return supersededByThreadIdByThreadId;
}

function getExclusiveLaneKey(mutation: TransactionActionMutation) {
  switch (mutation.type) {
    case 'child-archived':
    case 'child-restored':
      return `child-lifecycle:${mutation.childId}`;
    default:
      return null;
  }
}

function canMergePointEvent(
  event: TransactionEvent,
  childId: string,
  delta: number,
) {
  return (
    event.eventKind === 'action' &&
    isActionMutation(event.mutation) &&
    event.mutation.type === 'child-points-adjusted' &&
    event.mutation.source === 'tap' &&
    event.mutation.childId === childId &&
    Math.sign(event.mutation.delta) === Math.sign(delta)
  );
}

function createChildEntityRefs(childId: string, includeLifecycle = false) {
  return includeLifecycle
    ? [`child:${childId}`, `child-lifecycle:${childId}`]
    : [`child:${childId}`];
}

function createProjectionBaseHead(currentHead: PersistedAppData) {
  const defaultHead = createDefaultAppData();

  return {
    ...defaultHead,
    cart: currentHead.cart,
    parentSettings: currentHead.parentSettings,
    shopCatalog: currentHead.shopCatalog,
    timerConfig: currentHead.timerConfig,
    uiPreferences: currentHead.uiPreferences,
  } satisfies PersistedAppData;
}

function createDeviceId() {
  return `device-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createEventId(deviceId: string, deviceSequence: number) {
  return `evt:${deviceId}:${deviceSequence.toString().padStart(8, '0')}`;
}

function createThreadId(deviceId: string, deviceSequence: number) {
  return `thr:${deviceId}:${deviceSequence.toString().padStart(8, '0')}`;
}

function hashSharedHead(head: PersistedAppData) {
  return hashString(
    stableSerialize({
      children: head.children,
      timerState: head.timerState,
    }),
  );
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `h${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableSerialize(entryValue)}`,
      )
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function isSameTimerState(left: SharedTimerState, right: SharedTimerState) {
  return (
    left.cycleStartedAt === right.cycleStartedAt &&
    left.isRunning === right.isRunning &&
    left.pausedRemainingMs === right.pausedRemainingMs
  );
}

function sortThreadIdsForDisplay(
  threadIds: string[],
  transactions: TransactionRecord[],
) {
  const idByThreadId = new Map(
    transactions.map((transaction) => [transaction.threadId, transaction.id]),
  );

  return [...threadIds].sort(
    (left, right) =>
      (idByThreadId.get(right) ?? 0) - (idByThreadId.get(left) ?? 0),
  );
}
