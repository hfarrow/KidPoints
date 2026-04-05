import Constants from 'expo-constants';

import { appDataReducer, createDefaultAppData } from './state';
import type { ChildProfile, PersistedAppData, SharedTimerState } from './types';

export type TransactionStatus = 'applied' | 'reverted';
export type TransactionUndoPolicy = 'reversible' | 'tracked_only';
export type TransactionEntityRef = string;
export type TransactionEntryKind = 'action' | 'revert' | 'restore';

export type TransactionMutation =
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
      type: 'child-removed';
      childId: string;
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
    }
  | {
      type: 'revert-chain';
      targetRootTransactionIds: number[];
      targetTransactionIds: number[];
    }
  | {
      type: 'restore-chain';
      revertedTransactionId: number;
      targetRootTransactionIds: number[];
      targetTransactionIds: number[];
    }
  | {
      type: 'reapply-transactions';
      targetTransactionIds: number[];
    };

type LegacyChainMutation =
  | {
      type: 'revert-chain';
      targetTransactionIds: number[];
    }
  | {
      type: 'restore-chain';
      revertedTransactionId: number;
      targetTransactionIds: number[];
    };

export type TransactionRecord = {
  id: number;
  rootTransactionId: number;
  entryKind: TransactionEntryKind;
  kind: TransactionMutation['type'];
  occurredAt: number;
  actorDeviceName: string;
  status: TransactionStatus;
  undoPolicy: TransactionUndoPolicy;
  entityRefs: TransactionEntityRef[];
  dependsOnTransactionIds: number[];
  forward: TransactionMutation;
  inverse: TransactionMutation | null;
  revertedByTransactionId: number | null;
};

export type TransactionState = {
  nextTransactionId: number;
  transactions: TransactionRecord[];
};

export type PersistedAppDocument = {
  version: 3;
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
  transactionIds: number[];
};

const DOCUMENT_VERSION = 3;
const UNKNOWN_DEVICE_NAME = 'Unknown device';
const VALUE_CHANGE_ARROW = '\u2192';

export function createEmptyTransactionState(): TransactionState {
  return {
    nextTransactionId: 1,
    transactions: [],
  };
}

export function createDefaultAppDocument(): PersistedAppDocument {
  return {
    version: DOCUMENT_VERSION,
    head: createDefaultAppData(),
    transactionState: createEmptyTransactionState(),
  };
}

export function getTransactionActorDeviceName() {
  return Constants.deviceName?.trim() || UNKNOWN_DEVICE_NAME;
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
    Array.isArray(candidate.transactionState.transactions) &&
    typeof candidate.transactionState.nextTransactionId === 'number'
  );
}

export function coercePersistedAppDocument(
  value: unknown,
): PersistedAppDocument | null {
  if (isPersistedAppDocument(value)) {
    return {
      ...value,
      transactionState: {
        nextTransactionId: value.transactionState.nextTransactionId,
        transactions: normalizeTransactions(
          value.transactionState.transactions,
        ),
      },
    };
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    head?: PersistedAppData;
    transactionState?: {
      nextTransactionId?: number;
      transactions?: unknown[];
    };
    version?: number;
  };

  if (
    typeof candidate.head !== 'object' ||
    !candidate.head ||
    typeof candidate.transactionState !== 'object' ||
    !candidate.transactionState ||
    !Array.isArray(candidate.transactionState.transactions) ||
    typeof candidate.transactionState.nextTransactionId !== 'number'
  ) {
    return null;
  }

  return {
    version: DOCUMENT_VERSION,
    head: candidate.head,
    transactionState: {
      nextTransactionId: candidate.transactionState.nextTransactionId,
      transactions: normalizeTransactions(
        candidate.transactionState.transactions as TransactionRecord[],
      ),
    },
  };
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
      return commitAddChild(document, intent.name, actorDeviceName, occurredAt);
    case 'renameChild':
      return commitRenameChild(
        document,
        intent.childId,
        intent.name,
        actorDeviceName,
        occurredAt,
      );
    case 'archiveChild':
      return commitArchiveChild(
        document,
        intent.childId,
        intent.archivedAt,
        actorDeviceName,
        occurredAt,
      );
    case 'restoreChild':
      return commitRestoreChild(
        document,
        intent.childId,
        actorDeviceName,
        occurredAt,
      );
    case 'deleteChildPermanently':
      return commitDeleteChild(
        document,
        intent.childId,
        actorDeviceName,
        occurredAt,
      );
    case 'moveChild':
      return commitMoveChild(
        document,
        intent.childId,
        intent.direction,
        actorDeviceName,
        occurredAt,
      );
    case 'incrementPoints':
      return commitPointAdjustment(
        document,
        intent.childId,
        Math.abs(intent.amount),
        'tap',
        actorDeviceName,
        occurredAt,
      );
    case 'decrementPoints':
      return commitPointAdjustment(
        document,
        intent.childId,
        -Math.abs(intent.amount),
        'tap',
        actorDeviceName,
        occurredAt,
      );
    case 'setPoints':
      return commitSetPoints(
        document,
        intent.childId,
        intent.points,
        actorDeviceName,
        occurredAt,
      );
    case 'startTimer':
      return commitTimerStart(
        document,
        intent.startedAt,
        actorDeviceName,
        occurredAt,
      );
    case 'pauseTimer':
      return commitTimerPause(
        document,
        intent.pausedAt,
        actorDeviceName,
        occurredAt,
      );
    case 'resetTimer':
      return commitTimerReset(document, actorDeviceName, occurredAt);
    default:
      return document;
  }
}

export function getRevertPlan(
  transactionState: TransactionState,
  transactionId: number,
): RevertPlan {
  const target =
    transactionState.transactions.find(
      (transaction) => transaction.id === transactionId,
    ) ?? null;

  if (!target || !canRevertTransaction(target)) {
    return {
      target,
      transactionIds: [],
    };
  }

  const transactionIds = new Set<number>([target.id]);

  for (const transaction of transactionState.transactions) {
    if (
      transaction.status !== 'applied' ||
      transaction.entryKind !== 'action'
    ) {
      continue;
    }

    if (
      transaction.dependsOnTransactionIds.some((dependencyId) =>
        transactionIds.has(dependencyId),
      )
    ) {
      transactionIds.add(transaction.id);
    }
  }

  return {
    target,
    transactionIds: [...transactionIds].sort((left, right) => right - left),
  };
}

export function getRestorePlan(
  transactionState: TransactionState,
  transactionId: number,
): RevertPlan {
  const target =
    transactionState.transactions.find(
      (transaction) => transaction.id === transactionId,
    ) ?? null;

  if (!target || !canRestoreTransaction(target)) {
    return {
      target,
      transactionIds: [],
    };
  }

  const revertEvent = transactionState.transactions.find(
    (transaction) =>
      transaction.id === target.revertedByTransactionId &&
      transaction.entryKind === 'revert' &&
      transaction.forward.type === 'revert-chain',
  );

  if (!revertEvent) {
    return {
      target,
      transactionIds: [],
    };
  }

  if (revertEvent.forward.type !== 'revert-chain') {
    return {
      target,
      transactionIds: [],
    };
  }

  return {
    target,
    transactionIds: [...revertEvent.forward.targetTransactionIds].sort(
      (left, right) => right - left,
    ),
  };
}

export function revertTransaction(
  document: PersistedAppDocument,
  transactionId: number,
  meta: {
    actorDeviceName?: string;
    occurredAt?: number;
  } = {},
): PersistedAppDocument {
  const actorDeviceName =
    meta.actorDeviceName ?? getTransactionActorDeviceName();
  const occurredAt = meta.occurredAt ?? Date.now();
  const plan = getRevertPlan(document.transactionState, transactionId);

  if (!plan.target || plan.transactionIds.length === 0) {
    return document;
  }

  const revertTransactionId = document.transactionState.nextTransactionId;
  let nextHead = document.head;
  let nextTransactions = [...document.transactionState.transactions];

  for (const targetId of plan.transactionIds) {
    const transactionIndex = nextTransactions.findIndex(
      (transaction) => transaction.id === targetId,
    );

    if (transactionIndex === -1) {
      continue;
    }

    const transaction = nextTransactions[transactionIndex];

    if (transaction.kind === 'revert-chain') {
      nextHead = reapplyTransactions(
        nextHead,
        transaction.inverse,
        nextTransactions,
      );
      nextTransactions = nextTransactions.map((candidate) =>
        transaction.inverse?.type === 'reapply-transactions' &&
        transaction.inverse.targetTransactionIds.includes(candidate.id)
          ? {
              ...candidate,
              revertedByTransactionId: null,
              status: 'applied',
            }
          : candidate,
      );
    } else if (transaction.inverse) {
      nextHead = applyMutation(nextHead, transaction.inverse);
    }

    nextTransactions[transactionIndex] = {
      ...transaction,
      status: 'reverted',
      revertedByTransactionId: revertTransactionId,
    };
  }

  const targetTransactions = plan.transactionIds
    .map((targetId) =>
      nextTransactions.find((transaction) => transaction.id === targetId),
    )
    .filter(
      (transaction): transaction is TransactionRecord =>
        !!transaction && transaction.entryKind === 'action',
    );
  const targetRootTransactionIds = [
    ...new Set(
      targetTransactions.map((transaction) => transaction.rootTransactionId),
    ),
  ];
  const entityRefs = [
    ...new Set(
      targetTransactions.flatMap((transaction) => transaction.entityRefs),
    ),
  ];
  const revertRecord: TransactionRecord = {
    id: revertTransactionId,
    rootTransactionId: plan.target.rootTransactionId,
    entryKind: 'revert',
    kind: 'revert-chain',
    occurredAt,
    actorDeviceName,
    status: 'applied',
    undoPolicy: 'tracked_only',
    entityRefs,
    dependsOnTransactionIds: [...plan.transactionIds].sort(
      (left, right) => left - right,
    ),
    forward: {
      type: 'revert-chain',
      targetRootTransactionIds,
      targetTransactionIds: [...plan.transactionIds].sort(
        (left, right) => left - right,
      ),
    },
    inverse: null,
    revertedByTransactionId: null,
  };

  return {
    ...document,
    head: nextHead,
    transactionState: {
      nextTransactionId: revertTransactionId + 1,
      transactions: [...nextTransactions, revertRecord],
    },
  };
}

export function restoreTransaction(
  document: PersistedAppDocument,
  transactionId: number,
  meta: {
    actorDeviceName?: string;
    occurredAt?: number;
  } = {},
): PersistedAppDocument {
  const actorDeviceName =
    meta.actorDeviceName ?? getTransactionActorDeviceName();
  const occurredAt = meta.occurredAt ?? Date.now();
  const plan = getRestorePlan(document.transactionState, transactionId);

  if (!plan.target || plan.transactionIds.length === 0) {
    return document;
  }

  const revertedByTransactionId = plan.target.revertedByTransactionId;

  if (revertedByTransactionId === null) {
    return document;
  }

  let nextHead = document.head;
  const nextTransactions = [...document.transactionState.transactions];

  for (const targetId of [...plan.transactionIds].sort(
    (left, right) => left - right,
  )) {
    const transactionIndex = nextTransactions.findIndex(
      (transaction) => transaction.id === targetId,
    );

    if (transactionIndex === -1) {
      continue;
    }

    const transaction = nextTransactions[transactionIndex];

    nextHead = applyMutation(nextHead, transaction.forward);
    nextTransactions[transactionIndex] = {
      ...transaction,
      revertedByTransactionId: null,
      status: 'applied',
    };
  }

  const targetTransactions = plan.transactionIds
    .map((targetId) =>
      nextTransactions.find((transaction) => transaction.id === targetId),
    )
    .filter(
      (transaction): transaction is TransactionRecord =>
        !!transaction && transaction.entryKind === 'action',
    );
  const targetRootTransactionIds = [
    ...new Set(
      targetTransactions.map((transaction) => transaction.rootTransactionId),
    ),
  ];
  const entityRefs = [
    ...new Set(
      targetTransactions.flatMap((transaction) => transaction.entityRefs),
    ),
  ];
  const restoreEventId = document.transactionState.nextTransactionId;
  const restoreRecord: TransactionRecord = {
    id: restoreEventId,
    rootTransactionId: plan.target.rootTransactionId,
    entryKind: 'restore',
    kind: 'restore-chain',
    occurredAt,
    actorDeviceName,
    status: 'applied',
    undoPolicy: 'tracked_only',
    entityRefs,
    dependsOnTransactionIds: [revertedByTransactionId],
    forward: {
      type: 'restore-chain',
      revertedTransactionId: revertedByTransactionId,
      targetRootTransactionIds,
      targetTransactionIds: [...plan.transactionIds].sort(
        (left, right) => left - right,
      ),
    },
    inverse: null,
    revertedByTransactionId: null,
  };

  return {
    ...document,
    head: nextHead,
    transactionState: {
      nextTransactionId: restoreEventId + 1,
      transactions: [...nextTransactions, restoreRecord],
    },
  };
}

export function canRevertTransaction(transaction: TransactionRecord) {
  return (
    transaction.entryKind === 'action' &&
    transaction.undoPolicy === 'reversible' &&
    transaction.status === 'applied'
  );
}

export function canRestoreTransaction(transaction: TransactionRecord) {
  return (
    transaction.entryKind === 'action' &&
    transaction.undoPolicy === 'reversible' &&
    transaction.status === 'reverted' &&
    transaction.revertedByTransactionId !== null
  );
}

export function isVisibleTransaction(transaction: TransactionRecord) {
  return transaction.entryKind === 'action';
}

export type TransactionActivityEntry = {
  actorDeviceName: string;
  id: number;
  kind: TransactionEntryKind;
  occurredAt: number;
};

export function getVisibleTransactions(transactions: TransactionRecord[]) {
  return transactions.filter(isVisibleTransaction);
}

export function getTransactionActivityEntries(
  transaction: TransactionRecord,
  transactions: TransactionRecord[],
): TransactionActivityEntry[] {
  if (!isVisibleTransaction(transaction)) {
    return [];
  }

  return transactions
    .filter((candidate) => {
      if (candidate.id === transaction.id) {
        return true;
      }

      return (
        candidate.entryKind !== 'action' &&
        isTransactionAffectedByEvent(candidate, transaction.id)
      );
    })
    .sort((left, right) => left.id - right.id)
    .map((candidate) => ({
      actorDeviceName: candidate.actorDeviceName,
      id: candidate.id,
      kind: candidate.id === transaction.id ? 'action' : candidate.entryKind,
      occurredAt: candidate.occurredAt,
    }));
}

export function getTransactionSummary(
  transaction: TransactionRecord,
  transactions: TransactionRecord[] = [],
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
    case 'revert-chain':
      return getChainEventSummary('Reverted', transaction, transactions);
    case 'restore-chain':
      return getChainEventSummary('Restored', transaction, transactions);
    case 'child-removed':
    case 'reapply-transactions':
      return 'Transaction update';
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

function commitAddChild(
  document: PersistedAppDocument,
  name: string,
  actorDeviceName: string,
  occurredAt: number,
) {
  if (!name.trim()) {
    return document;
  }

  const nextHead = appDataReducer(document.head, { type: 'addChild', name });
  const newChild = nextHead.children.find(
    (child) =>
      !document.head.children.some(
        (existingChild) => existingChild.id === child.id,
      ),
  );

  if (!newChild) {
    return document;
  }

  return appendTransaction(document, nextHead, {
    actorDeviceName,
    dependsOnTransactionIds: [],
    entityRefs: createChildEntityRefs(newChild.id, true),
    forward: {
      type: 'child-added',
      child: newChild,
    },
    inverse: {
      type: 'child-removed',
      childId: newChild.id,
    },
    kind: 'child-added',
    occurredAt,
    undoPolicy: 'reversible',
  });
}

function commitRenameChild(
  document: PersistedAppDocument,
  childId: string,
  nextName: string,
  actorDeviceName: string,
  occurredAt: number,
) {
  const child = document.head.children.find(
    (candidate) => candidate.id === childId,
  );
  const trimmedName = nextName.trim();

  if (!child || !trimmedName || child.displayName === trimmedName) {
    return document;
  }

  const nextHead = appDataReducer(document.head, {
    type: 'renameChild',
    childId,
    name: trimmedName,
  });

  return appendTransaction(document, nextHead, {
    actorDeviceName,
    dependsOnTransactionIds: getChildLifecycleDependencies(
      document.transactionState,
      childId,
    ),
    entityRefs: createChildEntityRefs(childId),
    forward: {
      type: 'child-renamed',
      childId,
      nextName: trimmedName,
      previousName: child.displayName,
    },
    inverse: null,
    kind: 'child-renamed',
    occurredAt,
    undoPolicy: 'tracked_only',
  });
}

function commitArchiveChild(
  document: PersistedAppDocument,
  childId: string,
  archivedAt: number,
  actorDeviceName: string,
  occurredAt: number,
) {
  const child = document.head.children.find(
    (candidate) => candidate.id === childId && !candidate.isArchived,
  );

  if (!child) {
    return document;
  }

  const nextHead = appDataReducer(document.head, {
    type: 'archiveChild',
    childId,
    archivedAt,
  });

  return appendTransaction(document, nextHead, {
    actorDeviceName,
    dependsOnTransactionIds: getChildLifecycleDependencies(
      document.transactionState,
      childId,
    ),
    entityRefs: createChildEntityRefs(childId, true),
    forward: {
      type: 'child-archived',
      archivedAt,
      childId,
      childName: child.displayName,
      previousSortOrder: child.sortOrder,
    },
    inverse: {
      type: 'child-restored',
      archivedAt: child.archivedAt,
      childId,
      childName: child.displayName,
      restoredSortOrder: child.sortOrder,
    },
    kind: 'child-archived',
    occurredAt,
    undoPolicy: 'reversible',
  });
}

function commitRestoreChild(
  document: PersistedAppDocument,
  childId: string,
  actorDeviceName: string,
  occurredAt: number,
) {
  const child = document.head.children.find(
    (candidate) => candidate.id === childId && candidate.isArchived,
  );

  if (!child) {
    return document;
  }

  const restoredSortOrder = document.head.children.filter(
    (candidate) => !candidate.isArchived,
  ).length;
  const nextHead = appDataReducer(document.head, {
    type: 'restoreChildToOrder',
    childId,
    sortOrder: restoredSortOrder,
  });

  return appendTransaction(document, nextHead, {
    actorDeviceName,
    dependsOnTransactionIds: getChildLifecycleDependencies(
      document.transactionState,
      childId,
    ),
    entityRefs: createChildEntityRefs(childId, true),
    forward: {
      type: 'child-restored',
      archivedAt: child.archivedAt,
      childId,
      childName: child.displayName,
      restoredSortOrder,
    },
    inverse: {
      type: 'child-archived',
      archivedAt: child.archivedAt ?? occurredAt,
      childId,
      childName: child.displayName,
      previousSortOrder: restoredSortOrder,
    },
    kind: 'child-restored',
    occurredAt,
    undoPolicy: 'reversible',
  });
}

function commitDeleteChild(
  document: PersistedAppDocument,
  childId: string,
  actorDeviceName: string,
  occurredAt: number,
) {
  const child = document.head.children.find(
    (candidate) => candidate.id === childId,
  );

  if (!child) {
    return document;
  }

  const nextHead = appDataReducer(document.head, {
    type: 'deleteChildPermanently',
    childId,
  });

  return appendTransaction(document, nextHead, {
    actorDeviceName,
    dependsOnTransactionIds: getChildLifecycleDependencies(
      document.transactionState,
      childId,
    ),
    entityRefs: createChildEntityRefs(childId, true),
    forward: {
      type: 'child-deleted-permanently',
      child,
    },
    inverse: null,
    kind: 'child-deleted-permanently',
    occurredAt,
    undoPolicy: 'tracked_only',
  });
}

function commitMoveChild(
  document: PersistedAppDocument,
  childId: string,
  direction: 'up' | 'down',
  actorDeviceName: string,
  occurredAt: number,
) {
  const orderedChildren = [...document.head.children]
    .filter((child) => !child.isArchived)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const currentIndex = orderedChildren.findIndex(
    (child) => child.id === childId,
  );

  if (currentIndex === -1) {
    return document;
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= orderedChildren.length) {
    return document;
  }

  const child = orderedChildren[currentIndex];
  const nextHead = appDataReducer(document.head, {
    type: 'moveChild',
    childId,
    direction,
  });

  return appendTransaction(document, nextHead, {
    actorDeviceName,
    dependsOnTransactionIds: getChildLifecycleDependencies(
      document.transactionState,
      childId,
    ),
    entityRefs: createChildEntityRefs(childId),
    forward: {
      type: 'child-moved',
      childId,
      childName: child.displayName,
      direction,
      fromSortOrder: child.sortOrder,
      toSortOrder: orderedChildren[targetIndex]?.sortOrder ?? child.sortOrder,
    },
    inverse: null,
    kind: 'child-moved',
    occurredAt,
    undoPolicy: 'tracked_only',
  });
}

function commitPointAdjustment(
  document: PersistedAppDocument,
  childId: string,
  delta: number,
  source: 'tap' | 'set',
  actorDeviceName: string,
  occurredAt: number,
) {
  if (delta === 0) {
    return document;
  }

  const child = document.head.children.find(
    (candidate) => candidate.id === childId && !candidate.isArchived,
  );

  if (!child) {
    return document;
  }

  const nextHead = appDataReducer(document.head, {
    type: 'adjustPoints',
    childId,
    delta,
  });
  const lastTransaction = document.transactionState.transactions.at(-1);
  const nextChild = nextHead.children.find(
    (candidate) => candidate.id === childId,
  );

  if (!nextChild || nextChild.points === child.points) {
    return document;
  }

  const appliedDelta = nextChild.points - child.points;

  if (
    source === 'tap' &&
    lastTransaction &&
    canMergePointTransaction(lastTransaction, childId, appliedDelta) &&
    lastTransaction.forward.type === 'child-points-adjusted' &&
    lastTransaction.inverse?.type === 'child-points-adjusted'
  ) {
    const nextTransactions = [...document.transactionState.transactions];
    const updatedDelta = lastTransaction.forward.delta + appliedDelta;
    nextTransactions[nextTransactions.length - 1] = {
      ...lastTransaction,
      forward: {
        ...lastTransaction.forward,
        delta: updatedDelta,
        nextPoints: nextChild.points,
      },
      inverse: lastTransaction.inverse
        ? {
            ...lastTransaction.inverse,
            delta: -updatedDelta,
            nextPoints: lastTransaction.forward.previousPoints,
            previousPoints: nextChild.points,
          }
        : null,
    };

    return {
      ...document,
      head: nextHead,
      transactionState: {
        ...document.transactionState,
        transactions: nextTransactions,
      },
    };
  }

  return appendTransaction(document, nextHead, {
    actorDeviceName,
    dependsOnTransactionIds: getChildLifecycleDependencies(
      document.transactionState,
      childId,
    ),
    entityRefs: createChildEntityRefs(childId),
    forward: {
      type: 'child-points-adjusted',
      childId,
      childName: child.displayName,
      delta: appliedDelta,
      nextPoints: nextChild.points,
      previousPoints: child.points,
      source,
    },
    inverse: {
      type: 'child-points-adjusted',
      childId,
      childName: child.displayName,
      delta: -appliedDelta,
      nextPoints: child.points,
      previousPoints: nextChild.points,
      source,
    },
    kind: 'child-points-adjusted',
    occurredAt,
    undoPolicy: 'reversible',
  });
}

function commitSetPoints(
  document: PersistedAppDocument,
  childId: string,
  points: number,
  actorDeviceName: string,
  occurredAt: number,
) {
  const child = document.head.children.find(
    (candidate) => candidate.id === childId && !candidate.isArchived,
  );

  if (!child) {
    return document;
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
    return document;
  }

  return commitPointAdjustment(
    document,
    childId,
    nextChild.points - child.points,
    'set',
    actorDeviceName,
    occurredAt,
  );
}

function commitTimerStart(
  document: PersistedAppDocument,
  startedAt: number,
  actorDeviceName: string,
  occurredAt: number,
) {
  const nextHead = appDataReducer(document.head, {
    type: 'startTimer',
    startedAt,
  });

  if (isSameTimerState(document.head.timerState, nextHead.timerState)) {
    return document;
  }

  return appendTransaction(document, nextHead, {
    actorDeviceName,
    dependsOnTransactionIds: getTimerDependencies(document.transactionState),
    entityRefs: ['timer:shared'],
    forward: {
      type: 'timer-started',
      nextTimerState: nextHead.timerState,
      startedAt,
    },
    inverse: null,
    kind: 'timer-started',
    occurredAt,
    undoPolicy: 'tracked_only',
  });
}

function commitTimerPause(
  document: PersistedAppDocument,
  pausedAt: number,
  actorDeviceName: string,
  occurredAt: number,
) {
  const nextHead = appDataReducer(document.head, {
    type: 'pauseTimer',
    pausedAt,
  });

  if (isSameTimerState(document.head.timerState, nextHead.timerState)) {
    return document;
  }

  return appendTransaction(document, nextHead, {
    actorDeviceName,
    dependsOnTransactionIds: getTimerDependencies(document.transactionState),
    entityRefs: ['timer:shared'],
    forward: {
      type: 'timer-paused',
      nextTimerState: nextHead.timerState,
      pausedAt,
      previousTimerState: document.head.timerState,
    },
    inverse: null,
    kind: 'timer-paused',
    occurredAt,
    undoPolicy: 'tracked_only',
  });
}

function commitTimerReset(
  document: PersistedAppDocument,
  actorDeviceName: string,
  occurredAt: number,
) {
  const nextHead = appDataReducer(document.head, {
    type: 'resetTimer',
  });

  if (isSameTimerState(document.head.timerState, nextHead.timerState)) {
    return document;
  }

  return appendTransaction(document, nextHead, {
    actorDeviceName,
    dependsOnTransactionIds: getTimerDependencies(document.transactionState),
    entityRefs: ['timer:shared'],
    forward: {
      type: 'timer-reset',
      nextTimerState: nextHead.timerState,
      previousTimerState: document.head.timerState,
    },
    inverse: null,
    kind: 'timer-reset',
    occurredAt,
    undoPolicy: 'tracked_only',
  });
}

function appendTransaction(
  document: PersistedAppDocument,
  nextHead: PersistedAppData,
  draft: Omit<
    TransactionRecord,
    | 'entryKind'
    | 'id'
    | 'revertedByTransactionId'
    | 'rootTransactionId'
    | 'status'
  > & {
    entryKind?: TransactionEntryKind;
    rootTransactionId?: number;
  },
) {
  const nextId = document.transactionState.nextTransactionId;
  const transaction: TransactionRecord = {
    ...draft,
    entryKind: draft.entryKind ?? 'action',
    id: nextId,
    rootTransactionId: draft.rootTransactionId ?? nextId,
    revertedByTransactionId: null,
    status: 'applied',
  };

  return {
    ...document,
    head: nextHead,
    transactionState: {
      nextTransactionId: nextId + 1,
      transactions: [...document.transactionState.transactions, transaction],
    },
  };
}

function normalizeTransactions(transactions: TransactionRecord[]) {
  const rootTransactionIds = new Map<number, number>();

  return transactions.map((transaction) => {
    const normalizedRootTransactionId =
      typeof transaction.rootTransactionId === 'number'
        ? transaction.rootTransactionId
        : inferRootTransactionId(transaction, rootTransactionIds);
    const normalizedEntryKind =
      transaction.entryKind ?? inferEntryKind(transaction);
    const normalizedForward = normalizeLegacyMutation(
      transaction.forward,
      transactions,
      rootTransactionIds,
    );

    const normalizedTransaction: TransactionRecord = {
      ...transaction,
      entryKind: normalizedEntryKind,
      forward: normalizedForward,
      rootTransactionId: normalizedRootTransactionId,
    };

    rootTransactionIds.set(transaction.id, normalizedRootTransactionId);

    return normalizedTransaction;
  });
}

function inferEntryKind(transaction: TransactionRecord): TransactionEntryKind {
  if (transaction.kind === 'revert-chain') {
    return 'revert';
  }

  if (transaction.kind === 'restore-chain') {
    return 'restore';
  }

  return 'action';
}

function inferRootTransactionId(
  transaction: TransactionRecord,
  rootTransactionIds: Map<number, number>,
) {
  if (
    transaction.forward.type === 'revert-chain' ||
    transaction.forward.type === 'restore-chain'
  ) {
    const firstTargetId = transaction.forward.targetTransactionIds[0];

    if (typeof firstTargetId === 'number') {
      return rootTransactionIds.get(firstTargetId) ?? firstTargetId;
    }
  }

  return transaction.id;
}

function normalizeLegacyMutation(
  mutation: TransactionMutation | LegacyChainMutation,
  transactions: TransactionRecord[],
  rootTransactionIds: Map<number, number>,
): TransactionMutation {
  if (mutation.type !== 'revert-chain' && mutation.type !== 'restore-chain') {
    return mutation;
  }

  if ('targetRootTransactionIds' in mutation) {
    return mutation;
  }

  const targetRootTransactionIds = mutation.targetTransactionIds.map(
    (targetTransactionId) => {
      const existingRootTransactionId =
        rootTransactionIds.get(targetTransactionId);

      if (typeof existingRootTransactionId === 'number') {
        return existingRootTransactionId;
      }

      const targetTransaction = transactions.find(
        (candidate) => candidate.id === targetTransactionId,
      );

      return targetTransaction?.rootTransactionId ?? targetTransactionId;
    },
  );

  if (mutation.type === 'restore-chain') {
    return {
      ...mutation,
      targetRootTransactionIds,
    };
  }

  return {
    ...mutation,
    targetRootTransactionIds,
  };
}

function createChildEntityRefs(childId: string, includeLifecycle = false) {
  return includeLifecycle
    ? [`child:${childId}`, `child-lifecycle:${childId}`]
    : [`child:${childId}`];
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
        transaction.entryKind === 'action' &&
        transaction.entityRefs.includes(`child-lifecycle:${childId}`),
    );

  return dependency ? [dependency.id] : [];
}

function getTimerDependencies(transactionState: TransactionState) {
  const dependency = [...transactionState.transactions]
    .reverse()
    .find(
      (transaction) =>
        transaction.status === 'applied' &&
        transaction.entryKind === 'action' &&
        transaction.entityRefs.includes('timer:shared'),
    );

  return dependency ? [dependency.id] : [];
}

function canMergePointTransaction(
  transaction: TransactionRecord,
  childId: string,
  delta: number,
) {
  return (
    transaction.entryKind === 'action' &&
    transaction.status === 'applied' &&
    transaction.undoPolicy === 'reversible' &&
    transaction.forward.type === 'child-points-adjusted' &&
    transaction.forward.source === 'tap' &&
    transaction.forward.childId === childId &&
    Math.sign(transaction.forward.delta) === Math.sign(delta)
  );
}

function applyMutation(
  head: PersistedAppData,
  mutation: TransactionMutation,
): PersistedAppData {
  switch (mutation.type) {
    case 'child-points-adjusted':
      return appDataReducer(head, {
        type: 'adjustPoints',
        childId: mutation.childId,
        delta: mutation.delta,
      });
    case 'child-added':
      return appDataReducer(head, {
        type: 'addChildRecord',
        child: mutation.child,
      });
    case 'child-removed':
      return appDataReducer(head, {
        type: 'deleteChildPermanently',
        childId: mutation.childId,
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
    case 'restore-chain':
    case 'reapply-transactions':
    case 'revert-chain':
      return head;
    default:
      return head;
  }
}

function reapplyTransactions(
  head: PersistedAppData,
  mutation: TransactionMutation | null,
  transactions: TransactionRecord[],
) {
  if (!mutation || mutation.type !== 'reapply-transactions') {
    return head;
  }

  let nextHead = head;

  for (const targetId of [...mutation.targetTransactionIds].sort(
    (left, right) => left - right,
  )) {
    const transaction = transactions.find(
      (candidate) => candidate.id === targetId,
    );

    if (!transaction) {
      continue;
    }

    nextHead = applyMutation(nextHead, transaction.forward);
  }

  return nextHead;
}

function isSameTimerState(left: SharedTimerState, right: SharedTimerState) {
  return (
    left.cycleStartedAt === right.cycleStartedAt &&
    left.isRunning === right.isRunning &&
    left.pausedRemainingMs === right.pausedRemainingMs
  );
}

function isTransactionAffectedByEvent(
  transaction: TransactionRecord,
  targetTransactionId: number,
) {
  if (transaction.entryKind === 'action') {
    return false;
  }

  if (
    transaction.forward.type !== 'revert-chain' &&
    transaction.forward.type !== 'restore-chain'
  ) {
    return false;
  }

  return transaction.forward.targetTransactionIds.includes(targetTransactionId);
}

function getChainEventSummary(
  prefix: 'Reverted' | 'Restored',
  transaction: TransactionRecord,
  transactions: TransactionRecord[],
): string {
  if (
    transaction.forward.type !== 'revert-chain' &&
    transaction.forward.type !== 'restore-chain'
  ) {
    return 'Transaction';
  }

  const targetSummaries: string[] = transaction.forward.targetTransactionIds
    .map((targetTransactionId) =>
      transactions.find((candidate) => candidate.id === targetTransactionId),
    )
    .filter((candidate): candidate is TransactionRecord => !!candidate)
    .map((targetTransaction) => getTransactionSummary(targetTransaction));

  const primarySummary: string | undefined = targetSummaries[0];

  if (!primarySummary) {
    return `${prefix} action`;
  }

  if (targetSummaries.length === 1) {
    return `${prefix}: ${primarySummary}`;
  }

  return `${prefix}: ${primarySummary} + ${targetSummaries.length - 1} more`;
}
