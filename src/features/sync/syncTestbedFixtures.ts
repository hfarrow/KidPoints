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

  return cloneSharedDocument({
    ...sourceDocument,
    deviceId: TESTBED_LOCAL_DEVICE_ID,
    syncState: null,
  });
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
  const [firstChildId, secondChildId] = activeChildIds;

  if (firstChildId) {
    const firstChild =
      store.getState().document.head.childrenById[firstChildId];
    const nextPoints = (firstChild?.points ?? 0) + 3;

    store.getState().setPoints(firstChildId, nextPoints);
  }

  if (secondChildId) {
    const secondChild =
      store.getState().document.head.childrenById[secondChildId];
    const nextPoints = Math.max((secondChild?.points ?? 0) - 2, 0);

    store.getState().setPoints(secondChildId, nextPoints);
  }

  return deriveSyncProjection(store.getState().document);
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
