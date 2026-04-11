import { cloneTimerConfig, cloneTimerState } from './sharedTimer';
import type {
  ChildSnapshot,
  SharedDocument,
  SharedDocumentSnapshot,
  SharedEvent,
  SharedHead,
  SharedSyncState,
  StoredSyncBundle,
  StoredSyncRollbackSnapshot,
  TransactionKind,
  TransactionRecord,
} from './sharedTypes';

export type SyncProjectionScope = 'child-ledger';

export type SyncProjectionChild = Pick<
  ChildSnapshot,
  'createdAt' | 'id' | 'name' | 'points' | 'status' | 'updatedAt'
> & {
  archivedAt: string | null;
};

export type SyncProjectionHead = {
  activeChildIds: string[];
  archivedChildIds: string[];
  childrenById: Record<string, SyncProjectionChild>;
};

export type SyncableTransactionKind =
  | 'child-archived'
  | 'child-created'
  | 'child-deleted'
  | 'child-restored'
  | 'history-restored'
  | 'points-adjusted'
  | 'points-set';

export type SyncEntry = {
  affectedChildIds: string[];
  childId: string | null;
  childName: string | null;
  hash: string;
  kind: SyncableTransactionKind;
  occurredAt: string;
  originDeviceId: string;
  parentHash: string | null;
  pointsAfter: number | null;
  pointsBefore: number | null;
  restoredFromTransactionId: string | null;
  restoredToTransactionId: string | null;
  sourceTransactionId: string;
  stateAfter: SyncProjectionHead;
  stateHash: string;
};

export type SyncProjection = {
  entries: SyncEntry[];
  head: SyncProjectionHead;
  headHash: string;
  headSyncHash: string;
  scope: SyncProjectionScope;
  syncSchemaVersion: 2;
};

export type SyncProjectionValidationErrorCode =
  | 'entry-hash-mismatch'
  | 'entry-parent-hash-mismatch'
  | 'entry-state-hash-mismatch'
  | 'head-hash-mismatch'
  | 'head-sync-hash-mismatch'
  | 'scope-mismatch'
  | 'sync-schema-version-mismatch';

export type ValidateSyncProjectionResult =
  | {
      ok: true;
    }
  | {
      code: SyncProjectionValidationErrorCode;
      entryHash?: string;
      entryIndex?: number;
      message: string;
      ok: false;
    };

export type ResolveCommonSyncBaseResult =
  | {
      commonBaseEntry: SyncEntry | null;
      commonBaseHash: string | null;
      leftBaseIndex: number | null;
      mode: 'shared-base';
      ok: true;
      rightBaseIndex: number | null;
    }
  | {
      commonBaseHash: null;
      mode: 'bootstrap-left-to-right';
      ok: true;
    }
  | {
      commonBaseHash: null;
      mode: 'bootstrap-right-to-left';
      ok: true;
    }
  | {
      code:
        | 'independent-lineages'
        | 'invalid-left-projection'
        | 'invalid-right-projection'
        | 'invalid-bootstrap-target';
      message: string;
      ok: false;
    };

export type SyncPointReconciliation = {
  basePoints: number;
  childId: string;
  childName: string;
  leftDelta: number;
  leftPoints: number;
  mergedPoints: number;
  rightDelta: number;
  rightPoints: number;
};

export type ReconcileSyncProjectionsResult =
  | {
      childReconciliations: SyncPointReconciliation[];
      commonBaseHash: string | null;
      mergedHead: SyncProjectionHead;
      mergedHeadSyncHash: string;
      mode: 'bootstrap-left-to-right' | 'bootstrap-right-to-left' | 'merged';
      ok: true;
    }
  | {
      code:
        | 'child-shape-mismatch'
        | 'independent-lineages'
        | 'invalid-bootstrap-target'
        | 'invalid-left-projection'
        | 'invalid-right-projection'
        | 'unsupported-post-base-transaction';
      childId?: string;
      entryHash?: string;
      entryKind?: SyncableTransactionKind;
      message: string;
      ok: false;
      side?: 'left' | 'right';
    };

export type SyncBundleMode = 'bootstrap' | 'merged';

export type SyncBundle = {
  bootstrapHistory: SyncEntry[] | null;
  bundleHash: string;
  childReconciliations: SyncPointReconciliation[];
  commonBaseHash: string | null;
  mergedHead: SyncProjectionHead;
  mergedHeadSyncHash: string;
  mode: SyncBundleMode;
  participantHeadHashes: string[];
  participantHeadSyncHashes: string[];
  syncSchemaVersion: 2;
};

export type SyncRollbackSnapshot = {
  capturedAt: string;
  document: SharedDocument;
  projectionHeadHash: string;
  projectionHeadSyncHash: string;
};

export type PrepareSyncDeviceBundleResult =
  | {
      localProjection: SyncProjection;
      localRollbackSnapshot: SyncRollbackSnapshot;
      ok: true;
      sharedBundle: SyncBundle;
    }
  | Extract<ReconcileSyncProjectionsResult, { ok: false }>;

export type ConfirmSyncBundleAgreementResult =
  | {
      agreedBundleHash: string;
      agreedHeadSyncHash: string;
      ok: true;
    }
  | {
      code: 'bundle-hash-mismatch' | 'merged-head-sync-hash-mismatch';
      message: string;
      ok: false;
    };

const SYNC_PROJECTION_SCOPE = 'child-ledger' satisfies SyncProjectionScope;
export const CURRENT_SYNC_SCHEMA_VERSION = 2 as const;
const SYNCABLE_TRANSACTION_KINDS = new Set<TransactionKind>([
  'child-archived',
  'child-created',
  'child-deleted',
  'child-restored',
  'history-restored',
  'points-adjusted',
  'points-set',
]);

type CanonicalValue =
  | boolean
  | null
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

function sortIds(ids: string[]) {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function cloneSyncProjectionHead(head: SyncProjectionHead): SyncProjectionHead {
  return {
    activeChildIds: [...head.activeChildIds],
    archivedChildIds: [...head.archivedChildIds],
    childrenById: Object.fromEntries(
      Object.entries(head.childrenById).map(([childId, child]) => [
        childId,
        {
          ...child,
        },
      ]),
    ),
  };
}

function cloneSyncEntry(entry: SyncEntry): SyncEntry {
  return {
    affectedChildIds: [...entry.affectedChildIds],
    childId: entry.childId,
    childName: entry.childName,
    hash: entry.hash,
    kind: entry.kind,
    occurredAt: entry.occurredAt,
    originDeviceId: entry.originDeviceId,
    parentHash: entry.parentHash,
    pointsAfter: entry.pointsAfter,
    pointsBefore: entry.pointsBefore,
    restoredFromTransactionId: entry.restoredFromTransactionId,
    restoredToTransactionId: entry.restoredToTransactionId,
    sourceTransactionId: entry.sourceTransactionId,
    stateAfter: cloneSyncProjectionHead(entry.stateAfter),
    stateHash: entry.stateHash,
  };
}

function projectChildSnapshotForSync(
  child: ChildSnapshot,
): SyncProjectionChild {
  return {
    archivedAt: child.archivedAt ?? null,
    createdAt: child.createdAt,
    id: child.id,
    name: child.name,
    points: child.points,
    status: child.status,
    updatedAt: child.updatedAt,
  };
}

function cloneSharedEventRecordForSync(event: SharedEvent): SharedEvent {
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
          child: { ...event.payload.child },
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

function cloneSharedHeadForSync(head: SharedHead): SharedHead {
  return {
    activeChildIds: [...head.activeChildIds],
    archivedChildIds: [...head.archivedChildIds],
    childrenById: Object.fromEntries(
      Object.entries(head.childrenById).map(([childId, child]) => [
        childId,
        { ...child },
      ]),
    ),
    timerConfig: cloneTimerConfig(head.timerConfig),
    timerState: cloneTimerState(head.timerState),
  };
}

function cloneTransactionRecordForSync(
  transaction: TransactionRecord,
): TransactionRecord {
  return {
    ...transaction,
    affectedChildIds: [...transaction.affectedChildIds],
    eventIds: [...transaction.eventIds],
    stateAfter: cloneSharedHeadForSync(transaction.stateAfter),
  };
}

function cloneStoredSyncBundleForSync(
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

function cloneSharedDocumentSnapshotForSync(
  snapshot: SharedDocumentSnapshot | null | undefined,
): SharedDocumentSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return {
    currentHeadTransactionId: snapshot.currentHeadTransactionId,
    deviceId: snapshot.deviceId,
    events: snapshot.events.map(cloneSharedEventRecordForSync),
    head: cloneSharedHeadForSync(snapshot.head),
    isOrphanedRestoreWindowOpen: Boolean(snapshot.isOrphanedRestoreWindowOpen),
    nextSequence: snapshot.nextSequence,
    schemaVersion: snapshot.schemaVersion,
    transactions: snapshot.transactions.map(cloneTransactionRecordForSync),
  };
}

function cloneStoredSyncRollbackSnapshotForSync(
  snapshot: StoredSyncRollbackSnapshot | null | undefined,
): StoredSyncRollbackSnapshot | null {
  if (!snapshot) {
    return null;
  }

  const documentSnapshot = cloneSharedDocumentSnapshotForSync(
    snapshot.documentSnapshot,
  );

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

function cloneSharedSyncStateForSync(
  syncState: SharedSyncState | null | undefined,
): SharedSyncState | null {
  if (!syncState) {
    return null;
  }

  return {
    lastAppliedSync: cloneStoredSyncBundleForSync(syncState.lastAppliedSync),
    lastRollbackSnapshot: cloneStoredSyncRollbackSnapshotForSync(
      syncState.lastRollbackSnapshot,
    ),
  };
}

function cloneSharedDocumentForSync(document: SharedDocument): SharedDocument {
  return {
    currentHeadTransactionId: document.currentHeadTransactionId,
    deviceId: document.deviceId,
    events: document.events.map(cloneSharedEventRecordForSync),
    head: cloneSharedHeadForSync(document.head),
    isOrphanedRestoreWindowOpen: Boolean(document.isOrphanedRestoreWindowOpen),
    nextSequence: document.nextSequence,
    schemaVersion: document.schemaVersion,
    syncState: cloneSharedSyncStateForSync(document.syncState),
    transactions: document.transactions.map(cloneTransactionRecordForSync),
  };
}

function isSyncableTransaction(
  transaction: TransactionRecord,
): transaction is TransactionRecord & { kind: SyncableTransactionKind } {
  return (
    transaction.participatesInHistory &&
    SYNCABLE_TRANSACTION_KINDS.has(transaction.kind)
  );
}

function buildTransactionMap(transactions: TransactionRecord[]) {
  return new Map(
    transactions.map((transaction) => [transaction.id, transaction] as const),
  );
}

function deriveActiveHistoryBranch(document: SharedDocument) {
  const transactionsById = buildTransactionMap(document.transactions);
  const activeTransactions: TransactionRecord[] = [];
  const seenIds = new Set<string>();
  let currentId = document.currentHeadTransactionId;

  while (currentId) {
    if (seenIds.has(currentId)) {
      break;
    }

    seenIds.add(currentId);
    const transaction = transactionsById.get(currentId);

    if (!transaction) {
      break;
    }

    activeTransactions.push(transaction);
    currentId = transaction.parentTransactionId;
  }

  return activeTransactions.reverse();
}

function toCanonicalJson(value: CanonicalValue): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Sync projection cannot hash non-finite numbers.');
    }

    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => toCanonicalJson(item)).join(',')}]`;
  }

  const entries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return `{${entries
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${toCanonicalJson(entryValue)}`,
    )
    .join(',')}}`;
}

function hashCanonicalString(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `sync-${hash.toString(16).padStart(8, '0')}`;
}

function hashSyncValue(value: CanonicalValue) {
  return hashCanonicalString(toCanonicalJson(value));
}

export function projectSharedHeadForSync(head: SharedHead): SyncProjectionHead {
  const childrenById = Object.fromEntries(
    Object.entries(head.childrenById)
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
      .map(([childId, child]) => [childId, projectChildSnapshotForSync(child)]),
  );

  return {
    activeChildIds: sortIds(head.activeChildIds),
    archivedChildIds: sortIds(head.archivedChildIds),
    childrenById,
  };
}

function buildSyncEntryHash(args: {
  affectedChildIds: string[];
  childId: string | null;
  childName: string | null;
  kind: SyncableTransactionKind;
  occurredAt: string;
  originDeviceId: string;
  parentHash: string | null;
  pointsAfter: number | null;
  pointsBefore: number | null;
  restoredFromTransactionId: string | null;
  restoredToTransactionId: string | null;
  sourceTransactionId: string;
  stateHash: string;
}) {
  const {
    affectedChildIds,
    childId,
    childName,
    kind,
    occurredAt,
    originDeviceId,
    parentHash,
    pointsAfter,
    pointsBefore,
    restoredFromTransactionId,
    restoredToTransactionId,
    sourceTransactionId,
    stateHash,
  } = args;

  return hashSyncValue({
    affectedChildIds,
    childId,
    childName,
    kind,
    occurredAt,
    originDeviceId,
    parentHash,
    pointsAfter,
    pointsBefore,
    restoredFromTransactionId,
    restoredToTransactionId,
    sourceTransactionId,
    stateHash,
  });
}

export function deriveSyncProjection(document: SharedDocument): SyncProjection {
  const activeBranch = deriveActiveHistoryBranch(document).filter(
    isSyncableTransaction,
  );
  const entries: SyncEntry[] = [];
  let parentHash: string | null = null;

  for (const transaction of activeBranch) {
    const stateAfter = projectSharedHeadForSync(transaction.stateAfter);
    const stateHash = hashSyncValue(stateAfter);
    const entryHash = buildSyncEntryHash({
      affectedChildIds: sortIds(transaction.affectedChildIds),
      childId: transaction.childId,
      childName: transaction.childName,
      kind: transaction.kind,
      occurredAt: transaction.occurredAt,
      originDeviceId: transaction.originDeviceId,
      parentHash,
      pointsAfter: transaction.pointsAfter ?? null,
      pointsBefore: transaction.pointsBefore ?? null,
      restoredFromTransactionId: transaction.restoredFromTransactionId ?? null,
      restoredToTransactionId: transaction.restoredToTransactionId ?? null,
      sourceTransactionId: transaction.id,
      stateHash,
    });

    entries.push({
      affectedChildIds: sortIds(transaction.affectedChildIds),
      childId: transaction.childId,
      childName: transaction.childName,
      hash: entryHash,
      kind: transaction.kind,
      occurredAt: transaction.occurredAt,
      originDeviceId: transaction.originDeviceId,
      parentHash,
      pointsAfter: transaction.pointsAfter ?? null,
      pointsBefore: transaction.pointsBefore ?? null,
      restoredFromTransactionId: transaction.restoredFromTransactionId ?? null,
      restoredToTransactionId: transaction.restoredToTransactionId ?? null,
      sourceTransactionId: transaction.id,
      stateAfter,
      stateHash,
    });
    parentHash = entryHash;
  }

  const head = projectSharedHeadForSync(document.head);
  const headSyncHash = hashSyncValue(head);

  return {
    entries,
    head,
    headHash: entries.at(-1)?.hash ?? headSyncHash,
    headSyncHash,
    scope: SYNC_PROJECTION_SCOPE,
    syncSchemaVersion: CURRENT_SYNC_SCHEMA_VERSION,
  };
}

function isEmptySyncProjectionHead(head: SyncProjectionHead) {
  return (
    head.activeChildIds.length === 0 &&
    head.archivedChildIds.length === 0 &&
    Object.keys(head.childrenById).length === 0
  );
}

function validateProjectionEntryChain(
  projection: SyncProjection,
): ValidateSyncProjectionResult {
  let expectedParentHash: string | null = null;

  for (const [entryIndex, entry] of projection.entries.entries()) {
    const expectedStateHash = hashSyncValue(entry.stateAfter);

    if (entry.stateHash !== expectedStateHash) {
      return {
        code: 'entry-state-hash-mismatch',
        entryHash: entry.hash,
        entryIndex,
        message: `Sync entry ${entryIndex} has an invalid state hash.`,
        ok: false,
      };
    }

    if (entry.parentHash !== expectedParentHash) {
      return {
        code: 'entry-parent-hash-mismatch',
        entryHash: entry.hash,
        entryIndex,
        message: `Sync entry ${entryIndex} has an unexpected parent hash.`,
        ok: false,
      };
    }

    const expectedEntryHash = buildSyncEntryHash({
      affectedChildIds: entry.affectedChildIds,
      childId: entry.childId,
      childName: entry.childName,
      kind: entry.kind,
      occurredAt: entry.occurredAt,
      originDeviceId: entry.originDeviceId,
      parentHash: entry.parentHash,
      pointsAfter: entry.pointsAfter,
      pointsBefore: entry.pointsBefore,
      restoredFromTransactionId: entry.restoredFromTransactionId,
      restoredToTransactionId: entry.restoredToTransactionId,
      sourceTransactionId: entry.sourceTransactionId,
      stateHash: entry.stateHash,
    });

    if (entry.hash !== expectedEntryHash) {
      return {
        code: 'entry-hash-mismatch',
        entryHash: entry.hash,
        entryIndex,
        message: `Sync entry ${entryIndex} hash does not match its content.`,
        ok: false,
      };
    }

    expectedParentHash = entry.hash;
  }

  return { ok: true };
}

function areSyncChildrenEquivalentIgnoringPoints(
  left: SyncProjectionChild | null,
  right: SyncProjectionChild | null,
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
    left.status === right.status
  );
}

function createEmptySyncProjectionHead(): SyncProjectionHead {
  return {
    activeChildIds: [],
    archivedChildIds: [],
    childrenById: {},
  };
}

export function validateSyncProjection(
  projection: SyncProjection,
): ValidateSyncProjectionResult {
  if (projection.scope !== SYNC_PROJECTION_SCOPE) {
    return {
      code: 'scope-mismatch',
      message: `Unsupported sync projection scope: ${projection.scope}.`,
      ok: false,
    };
  }

  if (projection.syncSchemaVersion !== CURRENT_SYNC_SCHEMA_VERSION) {
    return {
      code: 'sync-schema-version-mismatch',
      message: `Unsupported sync schema version: ${projection.syncSchemaVersion}. Expected ${CURRENT_SYNC_SCHEMA_VERSION}.`,
      ok: false,
    };
  }

  const entryValidation = validateProjectionEntryChain(projection);

  if (!entryValidation.ok) {
    return entryValidation;
  }

  const expectedHeadSyncHash = hashSyncValue(projection.head);

  if (projection.headSyncHash !== expectedHeadSyncHash) {
    return {
      code: 'head-sync-hash-mismatch',
      message: 'Sync projection head hash does not match the projected head.',
      ok: false,
    };
  }

  const expectedHeadHash =
    projection.entries.at(-1)?.hash ?? projection.headSyncHash;

  if (projection.headHash !== expectedHeadHash) {
    return {
      code: 'head-hash-mismatch',
      message:
        'Sync projection head lineage hash does not match the active chain.',
      ok: false,
    };
  }

  return { ok: true };
}

export function resolveCommonSyncBase(args: {
  leftProjection: SyncProjection;
  rightProjection: SyncProjection;
}): ResolveCommonSyncBaseResult {
  const { leftProjection, rightProjection } = args;
  const leftValidation = validateSyncProjection(leftProjection);

  if (!leftValidation.ok) {
    return {
      code: 'invalid-left-projection',
      message: leftValidation.message,
      ok: false,
    };
  }

  const rightValidation = validateSyncProjection(rightProjection);

  if (!rightValidation.ok) {
    return {
      code: 'invalid-right-projection',
      message: rightValidation.message,
      ok: false,
    };
  }

  const rightIndexByHash = new Map(
    rightProjection.entries.map((entry, index) => [entry.hash, index] as const),
  );

  for (
    let leftIndex = leftProjection.entries.length - 1;
    leftIndex >= 0;
    leftIndex -= 1
  ) {
    const leftEntry = leftProjection.entries[leftIndex];

    if (!leftEntry) {
      continue;
    }

    const rightIndex = rightIndexByHash.get(leftEntry.hash);

    if (rightIndex == null) {
      continue;
    }

    return {
      commonBaseEntry: leftEntry,
      commonBaseHash: leftEntry.hash,
      leftBaseIndex: leftIndex,
      mode: 'shared-base',
      ok: true,
      rightBaseIndex: rightIndex,
    };
  }

  if (
    leftProjection.entries.length === 0 &&
    rightProjection.entries.length === 0 &&
    leftProjection.headSyncHash === rightProjection.headSyncHash
  ) {
    return {
      commonBaseEntry: null,
      commonBaseHash: null,
      leftBaseIndex: null,
      mode: 'shared-base',
      ok: true,
      rightBaseIndex: null,
    };
  }

  const leftIsEmpty =
    leftProjection.entries.length === 0 &&
    isEmptySyncProjectionHead(leftProjection.head);
  const rightIsEmpty =
    rightProjection.entries.length === 0 &&
    isEmptySyncProjectionHead(rightProjection.head);

  if (leftIsEmpty && rightIsEmpty) {
    return {
      code: 'invalid-bootstrap-target',
      message:
        'Both sync projections are empty, so there is nothing to bootstrap.',
      ok: false,
    };
  }

  if (leftIsEmpty) {
    return {
      commonBaseHash: null,
      mode: 'bootstrap-right-to-left',
      ok: true,
    };
  }

  if (rightIsEmpty) {
    return {
      commonBaseHash: null,
      mode: 'bootstrap-left-to-right',
      ok: true,
    };
  }

  return {
    code: 'independent-lineages',
    message:
      'The devices do not share a common sync base and cannot bootstrap over existing ledger history.',
    ok: false,
  };
}

export function reconcileSyncProjections(args: {
  leftProjection: SyncProjection;
  rightProjection: SyncProjection;
}): ReconcileSyncProjectionsResult {
  const { leftProjection, rightProjection } = args;
  const commonBaseResult = resolveCommonSyncBase({
    leftProjection,
    rightProjection,
  });

  if (!commonBaseResult.ok) {
    return commonBaseResult;
  }

  if (commonBaseResult.mode === 'bootstrap-left-to-right') {
    return {
      childReconciliations: [],
      commonBaseHash: null,
      mergedHead: leftProjection.head,
      mergedHeadSyncHash: leftProjection.headSyncHash,
      mode: commonBaseResult.mode,
      ok: true,
    };
  }

  if (commonBaseResult.mode === 'bootstrap-right-to-left') {
    return {
      childReconciliations: [],
      commonBaseHash: null,
      mergedHead: rightProjection.head,
      mergedHeadSyncHash: rightProjection.headSyncHash,
      mode: commonBaseResult.mode,
      ok: true,
    };
  }

  const leftPostBaseEntries = leftProjection.entries.slice(
    (commonBaseResult.leftBaseIndex ?? -1) + 1,
  );
  const rightPostBaseEntries = rightProjection.entries.slice(
    (commonBaseResult.rightBaseIndex ?? -1) + 1,
  );

  for (const [side, entries] of [
    ['left', leftPostBaseEntries] as const,
    ['right', rightPostBaseEntries] as const,
  ]) {
    const unsupportedEntry = entries.find(
      (entry) =>
        entry.kind !== 'points-adjusted' && entry.kind !== 'points-set',
    );

    if (unsupportedEntry) {
      return {
        code: 'unsupported-post-base-transaction',
        entryHash: unsupportedEntry.hash,
        entryKind: unsupportedEntry.kind,
        message: `The ${side} device has unsupported post-base transaction kind ${unsupportedEntry.kind}.`,
        ok: false,
        side,
      };
    }
  }

  const baseHead =
    commonBaseResult.commonBaseEntry?.stateAfter ??
    createEmptySyncProjectionHead();
  const mergedChildIds = sortIds([
    ...new Set([
      ...Object.keys(baseHead.childrenById),
      ...Object.keys(leftProjection.head.childrenById),
      ...Object.keys(rightProjection.head.childrenById),
    ]),
  ]);
  const childReconciliations: SyncPointReconciliation[] = [];
  const childrenById: Record<string, SyncProjectionChild> = {};

  for (const childId of mergedChildIds) {
    const baseChild = baseHead.childrenById[childId] ?? null;
    const leftChild = leftProjection.head.childrenById[childId] ?? null;
    const rightChild = rightProjection.head.childrenById[childId] ?? null;

    if (
      !areSyncChildrenEquivalentIgnoringPoints(baseChild, leftChild) ||
      !areSyncChildrenEquivalentIgnoringPoints(baseChild, rightChild) ||
      !areSyncChildrenEquivalentIgnoringPoints(leftChild, rightChild)
    ) {
      return {
        childId,
        code: 'child-shape-mismatch',
        message:
          'The devices disagree about a child outside of point totals, which Phase 3 does not reconcile.',
        ok: false,
      };
    }

    if (!baseChild || !leftChild || !rightChild) {
      return {
        childId,
        code: 'child-shape-mismatch',
        message:
          'The devices disagree about child membership outside of point totals, which Phase 3 does not reconcile.',
        ok: false,
      };
    }

    const basePoints = baseChild.points;
    const leftPoints = leftChild.points;
    const rightPoints = rightChild.points;
    const leftDelta = leftPoints - basePoints;
    const rightDelta = rightPoints - basePoints;
    const mergedPoints = basePoints + leftDelta + rightDelta;

    childReconciliations.push({
      basePoints,
      childId,
      childName: baseChild.name,
      leftDelta,
      leftPoints,
      mergedPoints,
      rightDelta,
      rightPoints,
    });
    childrenById[childId] = {
      ...baseChild,
      points: mergedPoints,
      updatedAt:
        sortIds([
          baseChild.updatedAt,
          leftChild.updatedAt,
          rightChild.updatedAt,
        ]).at(-1) ?? baseChild.updatedAt,
    };
  }

  const mergedHead: SyncProjectionHead = {
    activeChildIds: [...baseHead.activeChildIds],
    archivedChildIds: [...baseHead.archivedChildIds],
    childrenById,
  };

  return {
    childReconciliations,
    commonBaseHash: commonBaseResult.commonBaseHash,
    mergedHead,
    mergedHeadSyncHash: hashSyncValue(mergedHead),
    mode: 'merged',
    ok: true,
  };
}

function normalizeSyncBundleMode(
  mode: Extract<ReconcileSyncProjectionsResult, { ok: true }>['mode'],
): SyncBundleMode {
  return mode === 'merged' ? 'merged' : 'bootstrap';
}

function buildBootstrapHistory(args: {
  leftProjection: SyncProjection;
  mode: Extract<ReconcileSyncProjectionsResult, { ok: true }>['mode'];
  rightProjection: SyncProjection;
}) {
  const { leftProjection, mode, rightProjection } = args;

  if (mode === 'bootstrap-left-to-right') {
    return leftProjection.entries.map(cloneSyncEntry);
  }

  if (mode === 'bootstrap-right-to-left') {
    return rightProjection.entries.map(cloneSyncEntry);
  }

  return null;
}

function buildSyncBundle(args: {
  leftProjection: SyncProjection;
  reconcileResult: Extract<ReconcileSyncProjectionsResult, { ok: true }>;
  rightProjection: SyncProjection;
}): SyncBundle {
  const { leftProjection, reconcileResult, rightProjection } = args;
  const bundleCore = {
    bootstrapHistory: buildBootstrapHistory({
      leftProjection,
      mode: reconcileResult.mode,
      rightProjection,
    }),
    childReconciliations: reconcileResult.childReconciliations,
    commonBaseHash: reconcileResult.commonBaseHash,
    mergedHead: reconcileResult.mergedHead,
    mergedHeadSyncHash: reconcileResult.mergedHeadSyncHash,
    mode: normalizeSyncBundleMode(reconcileResult.mode),
    participantHeadHashes: sortIds([
      leftProjection.headHash,
      rightProjection.headHash,
    ]),
    participantHeadSyncHashes: sortIds([
      leftProjection.headSyncHash,
      rightProjection.headSyncHash,
    ]),
    syncSchemaVersion: CURRENT_SYNC_SCHEMA_VERSION,
  } satisfies Omit<SyncBundle, 'bundleHash'>;

  return {
    ...bundleCore,
    bundleHash: hashSyncValue(bundleCore),
  };
}

export function captureSyncRollbackSnapshot(args: {
  capturedAt?: string;
  document: SharedDocument;
  projection?: SyncProjection;
}): SyncRollbackSnapshot {
  const { capturedAt = new Date().toISOString(), document, projection } = args;
  const resolvedProjection = projection ?? deriveSyncProjection(document);

  return {
    capturedAt,
    document: cloneSharedDocumentForSync(document),
    projectionHeadHash: resolvedProjection.headHash,
    projectionHeadSyncHash: resolvedProjection.headSyncHash,
  };
}

export function prepareSyncDeviceBundle(args: {
  capturedAt?: string;
  localDocument: SharedDocument;
  remoteProjection: SyncProjection;
}): PrepareSyncDeviceBundleResult {
  const { capturedAt, localDocument, remoteProjection } = args;
  const localProjection = deriveSyncProjection(localDocument);
  const reconcileResult = reconcileSyncProjections({
    leftProjection: localProjection,
    rightProjection: remoteProjection,
  });

  if (!reconcileResult.ok) {
    return reconcileResult;
  }

  return {
    localProjection,
    localRollbackSnapshot: captureSyncRollbackSnapshot({
      capturedAt,
      document: localDocument,
      projection: localProjection,
    }),
    ok: true,
    sharedBundle: buildSyncBundle({
      leftProjection: localProjection,
      reconcileResult,
      rightProjection: remoteProjection,
    }),
  };
}

export function confirmSyncBundleAgreement(args: {
  leftBundle: SyncBundle;
  rightBundle: SyncBundle;
}): ConfirmSyncBundleAgreementResult {
  const { leftBundle, rightBundle } = args;

  if (leftBundle.mergedHeadSyncHash !== rightBundle.mergedHeadSyncHash) {
    return {
      code: 'merged-head-sync-hash-mismatch',
      message:
        'The devices derived different merged sync head hashes and must not commit the sync.',
      ok: false,
    };
  }

  if (leftBundle.bundleHash !== rightBundle.bundleHash) {
    return {
      code: 'bundle-hash-mismatch',
      message:
        'The devices derived different sync bundles and must not commit the sync.',
      ok: false,
    };
  }

  return {
    agreedBundleHash: leftBundle.bundleHash,
    agreedHeadSyncHash: leftBundle.mergedHeadSyncHash,
    ok: true,
  };
}

export function serializeSyncProjection(projection: SyncProjection) {
  const canonicalEntries = projection.entries.map((entry) => ({
    affectedChildIds: entry.affectedChildIds,
    childId: entry.childId,
    childName: entry.childName,
    hash: entry.hash,
    kind: entry.kind,
    occurredAt: entry.occurredAt,
    originDeviceId: entry.originDeviceId,
    parentHash: entry.parentHash,
    pointsAfter: entry.pointsAfter,
    pointsBefore: entry.pointsBefore,
    restoredFromTransactionId: entry.restoredFromTransactionId,
    restoredToTransactionId: entry.restoredToTransactionId,
    sourceTransactionId: entry.sourceTransactionId,
    stateAfter: entry.stateAfter,
    stateHash: entry.stateHash,
  }));

  return toCanonicalJson({
    entries: canonicalEntries,
    head: projection.head,
    headHash: projection.headHash,
    headSyncHash: projection.headSyncHash,
    scope: projection.scope,
    syncSchemaVersion: projection.syncSchemaVersion,
  });
}

export function serializeSyncBundle(bundle: SyncBundle) {
  return toCanonicalJson({
    bootstrapHistory:
      bundle.bootstrapHistory?.map((entry) => ({
        affectedChildIds: entry.affectedChildIds,
        childId: entry.childId,
        childName: entry.childName,
        hash: entry.hash,
        kind: entry.kind,
        occurredAt: entry.occurredAt,
        originDeviceId: entry.originDeviceId,
        parentHash: entry.parentHash,
        pointsAfter: entry.pointsAfter,
        pointsBefore: entry.pointsBefore,
        restoredFromTransactionId: entry.restoredFromTransactionId,
        restoredToTransactionId: entry.restoredToTransactionId,
        sourceTransactionId: entry.sourceTransactionId,
        stateAfter: entry.stateAfter,
        stateHash: entry.stateHash,
      })) ?? null,
    bundleHash: bundle.bundleHash,
    childReconciliations: bundle.childReconciliations,
    commonBaseHash: bundle.commonBaseHash,
    mergedHead: bundle.mergedHead,
    mergedHeadSyncHash: bundle.mergedHeadSyncHash,
    mode: bundle.mode,
    participantHeadHashes: bundle.participantHeadHashes,
    participantHeadSyncHashes: bundle.participantHeadSyncHashes,
    syncSchemaVersion: bundle.syncSchemaVersion,
  });
}
