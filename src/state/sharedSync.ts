import type {
  ChildSnapshot,
  SharedDocument,
  SharedHead,
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
  parentHash: string | null;
  pointsAfter: number | null;
  pointsBefore: number | null;
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
  syncSchemaVersion: 1;
};

const SYNC_PROJECTION_SCOPE = 'child-ledger' satisfies SyncProjectionScope;
const SYNC_SCHEMA_VERSION = 1 as const;
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
  parentHash: string | null;
  pointsAfter: number | null;
  pointsBefore: number | null;
  stateHash: string;
}) {
  const {
    affectedChildIds,
    childId,
    childName,
    kind,
    parentHash,
    pointsAfter,
    pointsBefore,
    stateHash,
  } = args;

  return hashSyncValue({
    affectedChildIds,
    childId,
    childName,
    kind,
    parentHash,
    pointsAfter,
    pointsBefore,
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
      parentHash,
      pointsAfter: transaction.pointsAfter ?? null,
      pointsBefore: transaction.pointsBefore ?? null,
      stateHash,
    });

    entries.push({
      affectedChildIds: sortIds(transaction.affectedChildIds),
      childId: transaction.childId,
      childName: transaction.childName,
      hash: entryHash,
      kind: transaction.kind,
      occurredAt: transaction.occurredAt,
      parentHash,
      pointsAfter: transaction.pointsAfter ?? null,
      pointsBefore: transaction.pointsBefore ?? null,
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
    syncSchemaVersion: SYNC_SCHEMA_VERSION,
  };
}

export function serializeSyncProjection(projection: SyncProjection) {
  const canonicalEntries = projection.entries.map((entry) => ({
    affectedChildIds: entry.affectedChildIds,
    childId: entry.childId,
    childName: entry.childName,
    hash: entry.hash,
    kind: entry.kind,
    parentHash: entry.parentHash,
    pointsAfter: entry.pointsAfter,
    pointsBefore: entry.pointsBefore,
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
