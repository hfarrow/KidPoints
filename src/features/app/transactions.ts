import Constants from 'expo-constants';

import {
  appDataReducer,
  createChildProfile,
  createDefaultAppData,
} from './state';
import type { ChildProfile, PersistedAppData, SharedTimerState } from './types';

export type TransactionEntityRef = string;
export type TransactionEntryKind = 'action' | 'restore';
export type RestoreDirection = 'backward' | 'forward';

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

export type ActionTransactionEvent = {
  actorDeviceName: string;
  deviceId: string;
  deviceSequence: number;
  entityRefs: TransactionEntityRef[];
  eventHash: string;
  eventId: string;
  eventKind: 'action';
  mutation: TransactionActionMutation;
  occurredAt: number;
  parentActionEventId: string | null;
  threadId: string;
};

export type RestoreTransactionEvent = {
  actorDeviceName: string;
  deviceId: string;
  deviceSequence: number;
  eventHash: string;
  eventId: string;
  eventKind: 'restore';
  occurredAt: number;
  targetActionEventId: string;
  windowTipActionEventId: string | null;
};

export type TransactionEvent = ActionTransactionEvent | RestoreTransactionEvent;

export type ActionTransactionRecord = {
  actorDeviceName: string;
  forward: TransactionActionMutation;
  id: number;
  isCurrent: boolean;
  isReachableRestorePoint: boolean;
  kind: TransactionActionMutation['type'];
  latestEventId: string;
  occurredAt: number;
  restoreDirection: RestoreDirection | null;
  rowId: string;
  rowKind: 'action';
  threadId: string;
};

export type RestoreTransactionRecord = {
  actorDeviceName: string;
  eventId: string;
  id: number;
  kind: 'restore-event';
  occurredAt: number;
  rowId: string;
  rowKind: 'restore';
  targetActionEventId: string;
  targetSummary: string;
};

export type TransactionRecord =
  | ActionTransactionRecord
  | RestoreTransactionRecord;

export type RestorePreview = {
  affectedActionEventIds: string[];
  isReachable: boolean;
  mode: RestoreDirection | null;
  target: ActionTransactionRecord | null;
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
  activeRestoreWindowTipActionEventId: string | null;
  canonicalHash: string;
  clientState: TransactionClientState;
  currentActionEventId: string | null;
  events: TransactionEvent[];
  headHash: string;
  transactions: TransactionRecord[];
};

export type PersistedAppDocument = {
  version: 5;
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

export type ReconciliationResult = {
  canonicalHashMismatches: string[];
  document: PersistedAppDocument;
};

type ActionDraft = {
  entityRefs: TransactionEntityRef[];
  mutation: TransactionActionMutation;
  threadId?: string;
};

type ActionThreadAccumulator = {
  actionEvents: ActionTransactionEvent[];
  actorDeviceName: string;
  anchorIndex: number;
  latestEventId: string;
  latestOccurredAt: number;
  rootEventId: string;
  threadId: string;
};

type RestoreEntryAccumulator = {
  actorDeviceName: string;
  anchorIndex: number;
  eventId: string;
  occurredAt: number;
  targetActionEventId: string;
};

type ActionRowDraft = {
  actorDeviceName: string;
  anchorIndex: number;
  forward: TransactionActionMutation;
  isCurrent: boolean;
  isReachableRestorePoint: boolean;
  kind: TransactionActionMutation['type'];
  latestEventId: string;
  occurredAt: number;
  restoreDirection: RestoreDirection | null;
  rowId: string;
  rowKind: 'action';
  threadId: string;
};

type RestoreRowDraft = {
  actorDeviceName: string;
  anchorIndex: number;
  eventId: string;
  kind: 'restore-event';
  occurredAt: number;
  rowId: string;
  rowKind: 'restore';
  targetActionEventId: string;
  targetSummary: string;
};

const DOCUMENT_VERSION = 5;
const UNKNOWN_DEVICE_NAME = 'Unknown device';
const VALUE_CHANGE_ARROW = '\u2192';

export function createEmptyTransactionState(
  deviceId = createDeviceId(),
): TransactionState {
  return {
    activeRestoreWindowTipActionEventId: null,
    canonicalHash: hashString(''),
    clientState: {
      deviceId,
      nextDeviceSequence: 1,
    },
    currentActionEventId: null,
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
  };

  if (typeof candidate.head !== 'object' || !candidate.head) {
    return null;
  }

  const rebuiltDocument = rebuildDocument({
    version: DOCUMENT_VERSION,
    head: candidate.head,
    transactionState: createEmptyTransactionState(),
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

export function getRestorePreview(
  transactionState: TransactionState,
  actionEventId: string,
): RestorePreview {
  const target = transactionState.transactions.find(
    (transaction): transaction is ActionTransactionRecord =>
      transaction.rowKind === 'action' &&
      transaction.latestEventId === actionEventId,
  );

  if (!target?.isReachableRestorePoint) {
    return {
      affectedActionEventIds: [],
      isReachable: false,
      mode: null,
      target: target ?? null,
    };
  }

  const actionEventsById = new Map(
    transactionState.events
      .filter(isActionEvent)
      .map((event) => [event.eventId, event]),
  );
  const currentActionEventId = transactionState.currentActionEventId;

  if (!currentActionEventId) {
    return {
      affectedActionEventIds: [],
      isReachable: false,
      mode: null,
      target,
    };
  }

  return {
    affectedActionEventIds:
      target.restoreDirection === 'backward'
        ? collectRollbackActionEventIds(
            currentActionEventId,
            target.latestEventId,
            actionEventsById,
          )
        : collectForwardActionEventIds(
            currentActionEventId,
            target.latestEventId,
            actionEventsById,
          ),
    isReachable: true,
    mode: target.restoreDirection,
    target,
  };
}

export function restoreTransaction(
  document: PersistedAppDocument,
  actionEventId: string,
  meta: {
    actorDeviceName?: string;
    occurredAt?: number;
  } = {},
): PersistedAppDocument {
  const preview = getRestorePreview(document.transactionState, actionEventId);

  if (!preview.target || !preview.isReachable) {
    return document;
  }

  const { event, nextClientState } = createRestoreEvent(
    document.transactionState,
    {
      actorDeviceName: meta.actorDeviceName ?? getTransactionActorDeviceName(),
      occurredAt: meta.occurredAt ?? Date.now(),
      targetActionEventId: actionEventId,
      windowTipActionEventId:
        document.transactionState.activeRestoreWindowTipActionEventId ??
        document.transactionState.currentActionEventId,
    },
  );

  return rebuildDocument({
    ...document,
    transactionState: {
      ...document.transactionState,
      clientState: nextClientState,
      events: [...document.transactionState.events, event],
    },
  });
}

export function canRestoreTransaction(transaction: TransactionRecord) {
  return (
    transaction.rowKind === 'action' &&
    transaction.isReachableRestorePoint &&
    !transaction.isCurrent
  );
}

export function isVisibleTransaction(_transaction: TransactionRecord) {
  return true;
}

export function getVisibleTransactions(transactions: TransactionRecord[]) {
  return transactions.filter(isVisibleTransaction);
}

export function getTransactionSummary(transaction: TransactionRecord): string {
  if (transaction.rowKind === 'restore') {
    return `Restored to ${transaction.targetSummary}`;
  }

  return getActionMutationSummary(transaction.forward);
}

function getActionMutationSummary(mutation: TransactionActionMutation): string {
  switch (mutation.type) {
    case 'child-points-adjusted': {
      const verb = mutation.delta >= 0 ? '+' : '-';

      return `${mutation.childName} ${verb}${Math.abs(mutation.delta)} points (${mutation.previousPoints} ${VALUE_CHANGE_ARROW} ${mutation.nextPoints})`;
    }
    case 'child-added':
      return `Added ${mutation.child.displayName}`;
    case 'child-archived':
      return `Archived ${mutation.childName}`;
    case 'child-restored':
      return `Restored ${mutation.childName}`;
    case 'child-renamed':
      return `${mutation.previousName} renamed to ${mutation.nextName}`;
    case 'child-moved':
      return `Reordered ${mutation.childName}`;
    case 'child-deleted-permanently':
      return `Deleted ${mutation.child.displayName}`;
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
  if (
    transaction.rowKind === 'action' &&
    transaction.forward.type === 'child-points-adjusted'
  ) {
    return `${transaction.forward.previousPoints} ${VALUE_CHANGE_ARROW} ${transaction.forward.nextPoints}`;
  }

  return null;
}

function appendActionEvent(
  document: PersistedAppDocument,
  draft: ActionDraft | null,
  actorDeviceName: string,
  occurredAt: number,
): PersistedAppDocument {
  if (!draft) {
    return document;
  }

  const { event, nextClientState } = createActionEvent(
    document.transactionState,
    {
      actorDeviceName,
      entityRefs: draft.entityRefs,
      mutation: draft.mutation,
      occurredAt,
      parentActionEventId: document.transactionState.currentActionEventId,
      threadId: draft.threadId,
    },
  );

  return rebuildDocument({
    ...document,
    transactionState: {
      ...document.transactionState,
      clientState: nextClientState,
      events: [...document.transactionState.events, event],
    },
  });
}

function createActionEvent(
  transactionState: TransactionState,
  input: {
    actorDeviceName: string;
    entityRefs: TransactionEntityRef[];
    mutation: TransactionActionMutation;
    occurredAt: number;
    parentActionEventId: string | null;
    threadId?: string;
  },
) {
  const deviceSequence = transactionState.clientState.nextDeviceSequence;
  const event: ActionTransactionEvent = withEventHash({
    actorDeviceName: input.actorDeviceName,
    deviceId: transactionState.clientState.deviceId,
    deviceSequence,
    entityRefs: [...input.entityRefs],
    eventId: createEventId(
      transactionState.clientState.deviceId,
      deviceSequence,
    ),
    eventKind: 'action',
    mutation: input.mutation,
    occurredAt: input.occurredAt,
    parentActionEventId: input.parentActionEventId,
    threadId:
      input.threadId ??
      createThreadId(transactionState.clientState.deviceId, deviceSequence),
  });

  return {
    event,
    nextClientState: {
      ...transactionState.clientState,
      nextDeviceSequence: deviceSequence + 1,
    },
  };
}

function createRestoreEvent(
  transactionState: TransactionState,
  input: {
    actorDeviceName: string;
    occurredAt: number;
    targetActionEventId: string;
    windowTipActionEventId: string | null;
  },
) {
  const deviceSequence = transactionState.clientState.nextDeviceSequence;
  const event: RestoreTransactionEvent = withEventHash({
    actorDeviceName: input.actorDeviceName,
    deviceId: transactionState.clientState.deviceId,
    deviceSequence,
    eventId: createEventId(
      transactionState.clientState.deviceId,
      deviceSequence,
    ),
    eventKind: 'restore',
    occurredAt: input.occurredAt,
    targetActionEventId: input.targetActionEventId,
    windowTipActionEventId: input.windowTipActionEventId,
  });

  return {
    event,
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
): {
  head: PersistedAppData;
  transactionState: TransactionState;
} {
  const dedupedEvents = dedupeEvents(events);

  if (dedupedEvents.length === 0) {
    return {
      head: currentHead,
      transactionState: {
        activeRestoreWindowTipActionEventId: null,
        canonicalHash: hashString(''),
        clientState,
        currentActionEventId: null,
        events: [],
        headHash: hashSharedHead(currentHead),
        transactions: [],
      },
    };
  }

  const orderedEvents = orderEvents(dedupedEvents);
  const canonicalHash = hashString(
    orderedEvents
      .map((event) => `${event.eventId}:${event.eventHash}`)
      .join('|'),
  );
  const actionEventsById = new Map<string, ActionTransactionEvent>();
  const threadMap = new Map<string, ActionThreadAccumulator>();
  const restoreEntries: RestoreEntryAccumulator[] = [];
  let currentActionEventId: string | null = null;
  let activeRestoreWindowTipActionEventId: string | null = null;

  orderedEvents.forEach((event, index) => {
    if (event.eventKind === 'action') {
      actionEventsById.set(event.eventId, event);

      const existingThread = threadMap.get(event.threadId);

      if (existingThread) {
        existingThread.actionEvents.push(event);
        existingThread.actorDeviceName = event.actorDeviceName;
        existingThread.latestEventId = event.eventId;
        existingThread.latestOccurredAt = event.occurredAt;
      } else {
        threadMap.set(event.threadId, {
          actionEvents: [event],
          actorDeviceName: event.actorDeviceName,
          anchorIndex: index,
          latestEventId: event.eventId,
          latestOccurredAt: event.occurredAt,
          rootEventId: event.eventId,
          threadId: event.threadId,
        });
      }

      currentActionEventId = event.eventId;
      activeRestoreWindowTipActionEventId = null;
      return;
    }

    restoreEntries.push({
      actorDeviceName: event.actorDeviceName,
      anchorIndex: index,
      eventId: event.eventId,
      occurredAt: event.occurredAt,
      targetActionEventId: event.targetActionEventId,
    });
    currentActionEventId = event.targetActionEventId;
    activeRestoreWindowTipActionEventId = event.windowTipActionEventId;
  });

  const nextHead = replayHead(
    currentHead,
    currentActionEventId,
    actionEventsById,
  );
  const currentLineageSet = new Set(
    collectLineageIds(currentActionEventId, actionEventsById),
  );
  const forwardLineageSet = new Set(
    collectForwardWindowIds(
      currentActionEventId,
      activeRestoreWindowTipActionEventId,
      actionEventsById,
    ),
  );
  const actionRows: ActionRowDraft[] = [...threadMap.values()]
    .sort(
      (left, right) =>
        left.anchorIndex - right.anchorIndex ||
        left.rootEventId.localeCompare(right.rootEventId),
    )
    .map((thread) => {
      const forward = aggregateThreadMutation(thread.actionEvents);
      const isCurrent = thread.latestEventId === currentActionEventId;
      const restoreDirection: RestoreDirection | null = isCurrent
        ? null
        : currentLineageSet.has(thread.latestEventId)
          ? 'backward'
          : forwardLineageSet.has(thread.latestEventId)
            ? 'forward'
            : null;

      return {
        actorDeviceName: thread.actorDeviceName,
        anchorIndex: thread.anchorIndex,
        forward,
        kind: forward.type,
        latestEventId: thread.latestEventId,
        occurredAt: thread.latestOccurredAt,
        restoreDirection,
        rowId: `action:${thread.threadId}`,
        rowKind: 'action' as const,
        threadId: thread.threadId,
        isCurrent,
        isReachableRestorePoint: restoreDirection !== null,
      };
    });
  const actionSummaryByLatestEventId = new Map(
    actionRows.map((row) => [
      row.latestEventId,
      getActionMutationSummary(row.forward),
    ]),
  );
  const restoreRows: RestoreRowDraft[] = restoreEntries.map((entry) => ({
    actorDeviceName: entry.actorDeviceName,
    anchorIndex: entry.anchorIndex,
    eventId: entry.eventId,
    kind: 'restore-event' as const,
    occurredAt: entry.occurredAt,
    rowId: `restore:${entry.eventId}`,
    rowKind: 'restore' as const,
    targetActionEventId: entry.targetActionEventId,
    targetSummary:
      actionSummaryByLatestEventId.get(entry.targetActionEventId) ??
      'Unknown restore point',
  }));
  const transactions = [...actionRows, ...restoreRows]
    .sort(
      (left, right) =>
        left.anchorIndex - right.anchorIndex ||
        left.occurredAt - right.occurredAt ||
        left.rowId.localeCompare(right.rowId),
    )
    .map((transaction, index) => {
      if (transaction.rowKind === 'action') {
        return {
          actorDeviceName: transaction.actorDeviceName,
          forward: transaction.forward,
          id: index + 1,
          isCurrent: transaction.isCurrent,
          isReachableRestorePoint: transaction.isReachableRestorePoint,
          kind: transaction.kind,
          latestEventId: transaction.latestEventId,
          occurredAt: transaction.occurredAt,
          restoreDirection: transaction.restoreDirection,
          rowId: transaction.rowId,
          rowKind: transaction.rowKind,
          threadId: transaction.threadId,
        } satisfies ActionTransactionRecord;
      }

      return {
        actorDeviceName: transaction.actorDeviceName,
        eventId: transaction.eventId,
        id: index + 1,
        kind: transaction.kind,
        occurredAt: transaction.occurredAt,
        rowId: transaction.rowId,
        rowKind: transaction.rowKind,
        targetActionEventId: transaction.targetActionEventId,
        targetSummary: transaction.targetSummary,
      } satisfies RestoreTransactionRecord;
    });

  return {
    head: nextHead,
    transactionState: {
      activeRestoreWindowTipActionEventId,
      canonicalHash,
      clientState,
      currentActionEventId,
      events: orderedEvents,
      headHash: hashSharedHead(nextHead),
      transactions,
    },
  };
}

function replayHead(
  currentHead: PersistedAppData,
  currentActionEventId: string | null,
  actionEventsById: Map<string, ActionTransactionEvent>,
) {
  const baseHead = createProjectionBaseHead(currentHead);
  const lineage = collectLineageIds(currentActionEventId, actionEventsById)
    .reverse()
    .map((eventId) => actionEventsById.get(eventId))
    .filter((event): event is ActionTransactionEvent => !!event);

  return lineage.reduce(
    (head, event) => applyActionMutation(head, event.mutation),
    baseHead,
  );
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
    entityRefs: createChildEntityRefs(child.id, true),
    mutation: {
      type: 'child-added',
      child,
    },
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
    entityRefs: createChildEntityRefs(childId),
    mutation: {
      type: 'child-renamed',
      childId,
      nextName: trimmedName,
      previousName: child.displayName,
    },
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
    entityRefs: createChildEntityRefs(childId, true),
    mutation: {
      type: 'child-archived',
      archivedAt,
      childId,
      childName: child.displayName,
      previousSortOrder: child.sortOrder,
    },
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
    entityRefs: createChildEntityRefs(childId, true),
    mutation: {
      type: 'child-restored',
      archivedAt: child.archivedAt,
      childId,
      childName: child.displayName,
      restoredSortOrder,
    },
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
    entityRefs: createChildEntityRefs(childId, true),
    mutation: {
      type: 'child-deleted-permanently',
      child,
    },
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
    entityRefs: createChildEntityRefs(childId),
    mutation: {
      type: 'child-moved',
      childId,
      childName: child.displayName,
      direction,
      fromSortOrder: child.sortOrder,
      toSortOrder: orderedChildren[targetIndex]?.sortOrder ?? child.sortOrder,
    },
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
    lastEvent?.eventKind === 'action' &&
    canMergePointEvent(lastEvent, childId, appliedDelta)
      ? lastEvent.threadId
      : undefined;

  return {
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
    entityRefs: ['timer:shared'],
    mutation: {
      type: 'timer-started',
      nextTimerState: nextHead.timerState,
      startedAt,
    },
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
    entityRefs: ['timer:shared'],
    mutation: {
      type: 'timer-paused',
      nextTimerState: nextHead.timerState,
      pausedAt,
      previousTimerState: document.head.timerState,
    },
  };
}

function buildTimerResetAction(
  document: PersistedAppDocument,
): ActionDraft | null {
  const nextHead = appDataReducer(document.head, {
    type: 'resetTimer',
  });

  if (
    isSameTimerState(document.head.timerState, nextHead.timerState) &&
    document.head.expiredIntervals.length === 0
  ) {
    return null;
  }

  return {
    entityRefs: ['timer:shared'],
    mutation: {
      type: 'timer-reset',
      nextTimerState: nextHead.timerState,
      previousTimerState: document.head.timerState,
    },
  };
}

function aggregateThreadMutation(actionEvents: ActionTransactionEvent[]) {
  const firstMutation = actionEvents[0]?.mutation;

  if (!firstMutation) {
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
    if (event.eventKind === 'action') {
      addEdge(event.parentActionEventId ?? undefined, event.eventId);
      continue;
    }

    addEdge(event.targetActionEventId, event.eventId);
    addEdge(event.windowTipActionEventId ?? undefined, event.eventId);
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

function collectLineageIds(
  actionEventId: string | null,
  actionEventsById: Map<string, ActionTransactionEvent>,
) {
  const lineageIds: string[] = [];
  let currentActionEventId = actionEventId;

  while (currentActionEventId) {
    lineageIds.push(currentActionEventId);
    currentActionEventId =
      actionEventsById.get(currentActionEventId)?.parentActionEventId ?? null;
  }

  return lineageIds;
}

function collectForwardWindowIds(
  currentActionEventId: string | null,
  windowTipActionEventId: string | null,
  actionEventsById: Map<string, ActionTransactionEvent>,
) {
  if (!currentActionEventId || !windowTipActionEventId) {
    return [] as string[];
  }

  const forwardIds: string[] = [];
  let cursor: string | null = windowTipActionEventId;

  while (cursor && cursor !== currentActionEventId) {
    forwardIds.push(cursor);
    cursor = actionEventsById.get(cursor)?.parentActionEventId ?? null;
  }

  return cursor === currentActionEventId ? forwardIds : [];
}

function collectRollbackActionEventIds(
  currentActionEventId: string,
  targetActionEventId: string,
  actionEventsById: Map<string, ActionTransactionEvent>,
) {
  const actionIds: string[] = [];
  let cursor: string | null = currentActionEventId;

  while (cursor && cursor !== targetActionEventId) {
    actionIds.push(cursor);
    cursor = actionEventsById.get(cursor)?.parentActionEventId ?? null;
  }

  return cursor === targetActionEventId ? actionIds : [];
}

function collectForwardActionEventIds(
  currentActionEventId: string,
  targetActionEventId: string,
  actionEventsById: Map<string, ActionTransactionEvent>,
) {
  const actionIds: string[] = [];
  let cursor: string | null = targetActionEventId;

  while (cursor && cursor !== currentActionEventId) {
    actionIds.push(cursor);
    cursor = actionEventsById.get(cursor)?.parentActionEventId ?? null;
  }

  return cursor === currentActionEventId ? actionIds : [];
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
      return appDataReducer(head, {
        type: 'startTimer',
        startedAt: mutation.startedAt,
      });
    case 'timer-paused':
      return appDataReducer(head, {
        type: 'pauseTimer',
        pausedAt: mutation.pausedAt,
      });
    case 'timer-reset':
      return appDataReducer(head, {
        type: 'resetTimer',
      });
    default:
      return head;
  }
}

function withEventHash<T extends Omit<TransactionEvent, 'eventHash'>>(
  event: T,
): T & { eventHash: string } {
  return {
    ...event,
    eventHash: hashString(stableSerialize(event)),
  };
}

function isActionEvent(
  event: TransactionEvent,
): event is ActionTransactionEvent {
  return event.eventKind === 'action';
}

function canMergePointEvent(
  event: TransactionEvent,
  childId: string,
  delta: number,
) {
  return (
    event.eventKind === 'action' &&
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
    expiredIntervals: currentHead.expiredIntervals,
    parentSettings: currentHead.parentSettings,
    shopCatalog: currentHead.shopCatalog,
    timerConfig: currentHead.timerConfig,
    timerRuntimeState: currentHead.timerRuntimeState,
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
