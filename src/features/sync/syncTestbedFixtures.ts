import type { StateStorage } from 'zustand/middleware';

import {
  cloneSharedDocument,
  createInitialSharedDocument,
  createSharedStore,
  deriveTransactionRows,
} from '../../state/sharedStore';
import {
  deriveSyncProjection,
  type SyncableTransactionKind,
  type SyncProjection,
} from '../../state/sharedSync';
import type {
  SharedDocument,
  TransactionRecord,
} from '../../state/sharedTypes';

export type SyncTestbedFixtureStrategyId =
  | 'bootstrap-left-to-right'
  | 'bootstrap-right-to-left'
  | 'independent-lineages'
  | 'shared-base';

export type SyncTestbedCommonBaseOption = {
  disabledReason: string | null;
  id: string;
  isHead: boolean;
  isMergeSafe: boolean;
  summaryText: string;
  timestampLabel: string;
};

const REMOTE_DEVICE_ID = 'sync-simulator-remote-device';
const TESTBED_LOCAL_DEVICE_ID = 'sync-testbed-local-device';
const MERGE_SAFE_POST_BASE_KINDS = new Set<SyncableTransactionKind>([
  'points-adjusted',
  'points-set',
]);

export function createSyncTestbedLocalSeedDocument(args: {
  sourceDocument: SharedDocument;
  strategyId: SyncTestbedFixtureStrategyId;
}): SharedDocument {
  const { sourceDocument, strategyId } = args;

  if (strategyId === 'bootstrap-right-to-left') {
    return createInitialSharedDocument({ deviceId: TESTBED_LOCAL_DEVICE_ID });
  }

  return cloneSharedDocument(
    remapDocumentIdentity({
      document: sourceDocument,
      nextDeviceId: TESTBED_LOCAL_DEVICE_ID,
    }),
  );
}

export function deriveSyncTestbedCommonBaseOptions(
  document: SharedDocument,
): SyncTestbedCommonBaseOption[] {
  const rows = deriveTransactionRows(document);
  const projection = deriveSyncProjection(document);
  const entryIndexByTransactionId = new Map(
    projection.entries.map((entry, index) => [
      entry.sourceTransactionId,
      index,
    ]),
  );

  return rows
    .filter((row) => !row.isOrphaned && entryIndexByTransactionId.has(row.id))
    .map((row) => {
      const baseIndex = entryIndexByTransactionId.get(row.id);
      const postBaseEntries =
        baseIndex == null ? [] : projection.entries.slice(baseIndex + 1);
      const unsupportedEntry = postBaseEntries.find(
        (entry) => !MERGE_SAFE_POST_BASE_KINDS.has(entry.kind),
      );

      return {
        disabledReason: unsupportedEntry
          ? 'Later local history changes child structure, so this point cannot anchor a shared-base merge preview.'
          : null,
        id: row.id,
        isHead: row.isHead,
        isMergeSafe: !unsupportedEntry,
        summaryText: row.summaryText,
        timestampLabel: row.timestampLabel,
      } satisfies SyncTestbedCommonBaseOption;
    });
}

export function pickDefaultSyncTestbedCommonBaseTransactionId(
  options: SyncTestbedCommonBaseOption[],
) {
  return (
    options.find((option) => option.isMergeSafe && !option.isHead)?.id ??
    options.find((option) => option.isMergeSafe)?.id ??
    null
  );
}

export function createSyncTestbedRemoteProjection(args: {
  commonBaseTransactionId: string | null;
  localDocument: SharedDocument;
  storage: StateStorage;
  strategyId: SyncTestbedFixtureStrategyId;
}): SyncProjection {
  const { commonBaseTransactionId, localDocument, storage, strategyId } = args;

  switch (strategyId) {
    case 'bootstrap-left-to-right':
      return deriveSyncProjection(
        createInitialSharedDocument({ deviceId: REMOTE_DEVICE_ID }),
      );
    case 'bootstrap-right-to-left':
    case 'independent-lineages':
      return createIndependentRemoteProjection(storage);
    case 'shared-base':
      if (!commonBaseTransactionId) {
        return createIndependentRemoteProjection(storage);
      }

      return createSharedBaseRemoteProjection({
        commonBaseTransactionId,
        localDocument,
        storage,
      });
  }
}

function createIndependentRemoteProjection(
  storage: StateStorage,
): SyncProjection {
  const store = createSharedStore({
    initialDocument: createInitialSharedDocument({
      deviceId: REMOTE_DEVICE_ID,
    }),
    storage,
  });

  store.getState().addChild('Maya');
  const firstChildId = store.getState().document.head.activeChildIds[0];

  if (firstChildId) {
    store.getState().setPoints(firstChildId, 9);
  }

  store.getState().addChild('Noah');
  const secondChildId = store.getState().document.head.activeChildIds[1];

  if (secondChildId) {
    store.getState().setPoints(secondChildId, 4);
  }

  return deriveSyncProjection(store.getState().document);
}

function createSharedBaseRemoteProjection(args: {
  commonBaseTransactionId: string;
  localDocument: SharedDocument;
  storage: StateStorage;
}): SyncProjection {
  const { commonBaseTransactionId, localDocument, storage } = args;
  const localProjection = deriveSyncProjection(localDocument);
  const localBaseIndex = localProjection.entries.findIndex(
    (entry) => entry.sourceTransactionId === commonBaseTransactionId,
  );
  const localPostBaseTimestamps =
    localBaseIndex >= 0
      ? localProjection.entries
          .slice(localBaseIndex + 1)
          .map((entry) => entry.occurredAt)
      : [];
  const baseDocument = buildDocumentAtTransaction({
    deviceId: REMOTE_DEVICE_ID,
    sourceDocument: localDocument,
    transactionId: commonBaseTransactionId,
  });

  if (!baseDocument) {
    return createIndependentRemoteProjection(storage);
  }

  const store = createSharedStore({
    initialDocument: baseDocument,
    storage,
  });
  const activeChildIds = store.getState().document.head.activeChildIds;
  const remoteEntryCount = Math.max(
    2,
    Math.min(4, localPostBaseTimestamps.length || 2),
  );
  const operationTargets = Array.from(
    { length: remoteEntryCount },
    (_, index) =>
      activeChildIds.length > 0
        ? activeChildIds[index % activeChildIds.length]
        : undefined,
  );

  for (const [operationIndex, childId] of operationTargets.entries()) {
    if (!childId) {
      continue;
    }

    const child = store.getState().document.head.childrenById[childId];
    const currentPoints = child?.points ?? 0;

    if (operationIndex % 2 === 0) {
      store.getState().setPoints(childId, currentPoints + operationIndex + 2);
      continue;
    }

    const delta = childId === activeChildIds[1] ? -1 : 1;
    const nextPoints = Math.max(currentPoints + delta, 0);

    store.getState().setPoints(childId, nextPoints);
  }

  const interleavedRemoteDocument = remapPostBaseTransactionTimestamps({
    baseTransactionId: commonBaseTransactionId,
    document: store.getState().document,
    desiredOccurredAt: buildInterleavedTimestampPlan({
      baseOccurredAt:
        localProjection.entries[localBaseIndex]?.occurredAt ??
        new Date().toISOString(),
      localPostBaseTimestamps,
      remoteEntryCount,
    }),
  });

  return deriveSyncProjection(interleavedRemoteDocument);
}

function buildDocumentAtTransaction(args: {
  deviceId: string;
  sourceDocument: SharedDocument;
  transactionId: string;
}) {
  const { deviceId, sourceDocument, transactionId } = args;
  const rows = deriveTransactionRows(sourceDocument);
  const targetRow = rows.find(
    (row) => row.id === transactionId && !row.isOrphaned,
  );

  if (!targetRow) {
    return null;
  }

  const transactionsById = new Map(
    sourceDocument.transactions.map((transaction) => [
      transaction.id,
      transaction,
    ]),
  );
  const retainedTransactionIds = new Set<string>();
  let currentTransactionId: string | null = transactionId;

  while (currentTransactionId) {
    if (retainedTransactionIds.has(currentTransactionId)) {
      break;
    }

    retainedTransactionIds.add(currentTransactionId);
    currentTransactionId =
      transactionsById.get(currentTransactionId)?.parentTransactionId ?? null;
  }

  const retainedTransactions = sourceDocument.transactions.filter(
    (transaction) => retainedTransactionIds.has(transaction.id),
  );
  const retainedEventIds = new Set(
    retainedTransactions.flatMap((transaction) => transaction.eventIds),
  );
  const retainedEvents = sourceDocument.events.filter((event) =>
    retainedEventIds.has(event.eventId),
  );

  return cloneSharedDocument({
    ...sourceDocument,
    currentHeadTransactionId: transactionId,
    deviceId,
    events: retainedEvents,
    head: targetRow.stateAfter,
    isOrphanedRestoreWindowOpen: false,
    syncState: null,
    transactions: retainedTransactions.map(cloneTransactionRecord),
  });
}

function cloneTransactionRecord(
  transaction: TransactionRecord,
): TransactionRecord {
  return {
    ...transaction,
    affectedChildIds: [...transaction.affectedChildIds],
    eventIds: [...transaction.eventIds],
    stateAfter: {
      ...transaction.stateAfter,
      activeChildIds: [...transaction.stateAfter.activeChildIds],
      archivedChildIds: [...transaction.stateAfter.archivedChildIds],
      childrenById: Object.fromEntries(
        Object.entries(transaction.stateAfter.childrenById).map(
          ([childId, child]) => [childId, { ...child }],
        ),
      ),
      timerConfig: { ...transaction.stateAfter.timerConfig },
      timerState: { ...transaction.stateAfter.timerState },
    },
  };
}

function buildInterleavedTimestampPlan(args: {
  baseOccurredAt: string;
  localPostBaseTimestamps: string[];
  remoteEntryCount: number;
}) {
  const { baseOccurredAt, localPostBaseTimestamps, remoteEntryCount } = args;
  const parsedLocalTimes = localPostBaseTimestamps
    .map((timestamp) => Date.parse(timestamp))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const parsedBaseTime = Date.parse(baseOccurredAt);
  let lastAssignedTime = Number.isFinite(parsedBaseTime)
    ? parsedBaseTime
    : Date.now();

  return Array.from({ length: remoteEntryCount }, (_, index) => {
    let nextTime = lastAssignedTime + 1000;

    if (parsedLocalTimes.length > 0 && index < parsedLocalTimes.length) {
      const currentLocalTime = parsedLocalTimes[index];
      const nextLocalTime =
        parsedLocalTimes[index + 1] ?? currentLocalTime + 2000;
      const midpointTime =
        currentLocalTime +
        Math.max(Math.floor((nextLocalTime - currentLocalTime) / 2), 1);

      nextTime = midpointTime;
    }

    if (nextTime <= lastAssignedTime) {
      nextTime = lastAssignedTime + 1;
    }

    lastAssignedTime = nextTime;
    return new Date(nextTime).toISOString();
  });
}

function remapPostBaseTransactionTimestamps(args: {
  baseTransactionId: string;
  desiredOccurredAt: string[];
  document: SharedDocument;
}) {
  const { baseTransactionId, desiredOccurredAt, document } = args;
  const baseIndex = document.transactions.findIndex(
    (transaction) => transaction.id === baseTransactionId,
  );

  if (baseIndex < 0) {
    return document;
  }

  let nextTimestampIndex = 0;

  return {
    ...document,
    transactions: document.transactions.map((transaction, index) => {
      if (
        index <= baseIndex ||
        !transaction.participatesInHistory ||
        nextTimestampIndex >= desiredOccurredAt.length
      ) {
        return cloneTransactionRecord(transaction);
      }

      const occurredAt =
        desiredOccurredAt[nextTimestampIndex] ?? transaction.occurredAt;
      nextTimestampIndex += 1;

      return {
        ...cloneTransactionRecord(transaction),
        occurredAt,
      };
    }),
  };
}

function remapDocumentIdentity(args: {
  document: SharedDocument;
  nextDeviceId: string;
}): SharedDocument {
  const { document, nextDeviceId } = args;
  const previousDeviceId = document.deviceId;

  return {
    ...document,
    deviceId: nextDeviceId,
    events: document.events.map((event) => ({
      ...event,
      deviceId:
        event.deviceId === previousDeviceId ? nextDeviceId : event.deviceId,
    })),
    syncState: null,
    transactions: document.transactions.map((transaction) => ({
      ...cloneTransactionRecord(transaction),
      originDeviceId:
        transaction.originDeviceId === previousDeviceId
          ? nextDeviceId
          : transaction.originDeviceId,
    })),
  };
}
