import type {
  SyncBundle,
  SyncEntry,
  SyncProjection,
} from '../../state/sharedSync';

export type SyncReviewOutcome =
  | 'incoming-bootstrap'
  | 'merged'
  | 'outgoing-bootstrap';

export type SyncReviewChildRow = {
  basePoints: number;
  change: 'added' | 'removed' | 'unchanged';
  childId: string;
  childName: string;
  localNewContributionPoints: number;
  points: number;
  remoteNewContributionPoints: number;
};

export type SyncReviewTransactionItem = {
  id: string;
  origin: 'base' | 'local' | 'remote';
  summaryText: string;
  timestampLabel: string;
};

export type SyncReviewModel = {
  children: SyncReviewChildRow[];
  outcome: SyncReviewOutcome;
  outcomeCopy: string;
  transactions: SyncReviewTransactionItem[];
};

function formatSyncTimestamp(occurredAt: string) {
  return new Date(occurredAt).toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

function summarizeSyncRestoreTarget(
  targetEntry: SyncEntry | undefined,
  entriesById: Map<string, SyncEntry>,
): string {
  if (!targetEntry) {
    return 'Earlier State';
  }

  switch (targetEntry.kind) {
    case 'points-adjusted': {
      if (
        targetEntry.childName &&
        targetEntry.pointsBefore != null &&
        targetEntry.pointsAfter != null
      ) {
        const delta = targetEntry.pointsAfter - targetEntry.pointsBefore;
        const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;

        return `${targetEntry.childName} ${deltaLabel} Points [${targetEntry.pointsBefore} > ${targetEntry.pointsAfter}]`;
      }

      return 'Point Change';
    }
    case 'points-set':
      if (
        targetEntry.childName &&
        targetEntry.pointsBefore != null &&
        targetEntry.pointsAfter != null
      ) {
        return `${targetEntry.childName} Set Points [${targetEntry.pointsBefore} > ${targetEntry.pointsAfter}]`;
      }

      return 'Point Total Update';
    case 'child-created':
      return targetEntry.childName
        ? `${targetEntry.childName} Added`
        : 'Child Added';
    case 'child-archived':
      return targetEntry.childName
        ? `${targetEntry.childName} Archived`
        : 'Child Archived';
    case 'child-restored':
      return targetEntry.childName
        ? `${targetEntry.childName} Unarchived`
        : 'Child Unarchived';
    case 'child-deleted':
      return targetEntry.childName
        ? `${targetEntry.childName} Deleted`
        : 'Child Deleted';
    case 'history-restored': {
      const nestedTarget = targetEntry.restoredToTransactionId
        ? entriesById.get(targetEntry.restoredToTransactionId)
        : undefined;

      return nestedTarget
        ? summarizeSyncRestoreTarget(nestedTarget, entriesById)
        : 'Earlier State';
    }
  }
}

function summarizeSyncEntry(
  entry: SyncEntry,
  entriesById: Map<string, SyncEntry>,
) {
  switch (entry.kind) {
    case 'points-adjusted': {
      if (
        entry.childName &&
        entry.pointsBefore != null &&
        entry.pointsAfter != null
      ) {
        const delta = entry.pointsAfter - entry.pointsBefore;
        const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;

        return `${entry.childName} ${deltaLabel} Points [${entry.pointsBefore} > ${entry.pointsAfter}]`;
      }

      return 'Point Change';
    }
    case 'points-set':
      if (
        entry.childName &&
        entry.pointsBefore != null &&
        entry.pointsAfter != null
      ) {
        return `${entry.childName} Set Points [${entry.pointsBefore} > ${entry.pointsAfter}]`;
      }

      return 'Point Total Update';
    case 'child-created':
      return entry.childName ? `${entry.childName} Added` : 'Child Added';
    case 'child-archived':
      return entry.childName ? `${entry.childName} Archived` : 'Child Archived';
    case 'child-restored':
      return entry.childName
        ? `${entry.childName} Unarchived`
        : 'Child Unarchived';
    case 'child-deleted':
      return entry.childName ? `${entry.childName} Deleted` : 'Child Deleted';
    case 'history-restored': {
      const targetEntry = entry.restoredToTransactionId
        ? entriesById.get(entry.restoredToTransactionId)
        : undefined;

      return `Restored App to ${summarizeSyncRestoreTarget(targetEntry, entriesById)}`;
    }
  }
}

function getPostBaseEntries(
  projection: SyncProjection,
  commonBaseHash: string | null,
) {
  if (!commonBaseHash) {
    return projection.entries;
  }

  const baseIndex = projection.entries.findIndex(
    (entry) => entry.hash === commonBaseHash,
  );

  return baseIndex >= 0
    ? projection.entries.slice(baseIndex + 1)
    : projection.entries;
}

function findEntryByHash(
  projection: SyncProjection,
  entryHash: string | null,
): SyncEntry | null {
  if (!entryHash) {
    return null;
  }

  return projection.entries.find((entry) => entry.hash === entryHash) ?? null;
}

function buildReviewTransactionItems(args: {
  bundle: SyncBundle;
  localDeviceId: string;
  localProjection: SyncProjection;
  remoteProjection: SyncProjection;
}): SyncReviewTransactionItem[] {
  const { bundle, localDeviceId, localProjection, remoteProjection } = args;

  if (bundle.mode === 'bootstrap') {
    const sourceProjection =
      localProjection.entries.length === 0 ? remoteProjection : localProjection;
    const entriesById = new Map(
      sourceProjection.entries.map((entry) => [
        entry.sourceTransactionId,
        entry,
      ]),
    );

    return [...sourceProjection.entries].reverse().map((entry) => ({
      id: entry.hash,
      origin:
        entry.originDeviceId === localDeviceId
          ? ('local' as const)
          : ('remote' as const),
      summaryText: summarizeSyncEntry(entry, entriesById),
      timestampLabel: formatSyncTimestamp(entry.occurredAt),
    }));
  }

  const localEntries = getPostBaseEntries(
    localProjection,
    bundle.commonBaseHash,
  );
  const remoteEntries = getPostBaseEntries(
    remoteProjection,
    bundle.commonBaseHash,
  );
  const entriesById = new Map(
    [...localProjection.entries, ...remoteProjection.entries].map((entry) => [
      entry.sourceTransactionId,
      entry,
    ]),
  );
  const baseEntry =
    findEntryByHash(localProjection, bundle.commonBaseHash) ??
    findEntryByHash(remoteProjection, bundle.commonBaseHash);
  const baseTransaction = baseEntry
    ? {
        id: `base-${baseEntry.hash}`,
        origin: 'base' as const,
        summaryText: summarizeSyncEntry(baseEntry, entriesById),
        timestampLabel: formatSyncTimestamp(baseEntry.occurredAt),
      }
    : null;

  const postBaseTransactions = [...localEntries, ...remoteEntries]
    .map((entry) => ({
      entry,
      origin:
        entry.originDeviceId === localDeviceId
          ? ('local' as const)
          : ('remote' as const),
    }))
    .sort((left, right) => {
      if (left.entry.occurredAt !== right.entry.occurredAt) {
        return right.entry.occurredAt.localeCompare(left.entry.occurredAt);
      }

      if (left.origin !== right.origin) {
        return left.origin === 'local' ? -1 : 1;
      }

      return left.entry.hash.localeCompare(right.entry.hash);
    })
    .map(({ entry, origin }) => ({
      id: entry.hash,
      origin,
      summaryText: summarizeSyncEntry(entry, entriesById),
      timestampLabel: formatSyncTimestamp(entry.occurredAt),
    }));

  return baseTransaction
    ? [...postBaseTransactions, baseTransaction]
    : postBaseTransactions;
}

function buildReviewChildren(args: {
  bundle: SyncBundle;
  localProjection: SyncProjection;
  remoteProjection: SyncProjection;
  mergedHead: SyncBundle['mergedHead'];
}) {
  const { bundle, localProjection, mergedHead, remoteProjection } = args;
  const localChildIds = new Set(Object.keys(localProjection.head.childrenById));
  const mergedChildIds = new Set(Object.keys(mergedHead.childrenById));
  const reconciliationsByChildId = new Map(
    bundle.childReconciliations.map((reconciliation) => [
      reconciliation.childId,
      reconciliation,
    ]),
  );
  const mergedChildren: SyncReviewChildRow[] = Object.entries(
    mergedHead.childrenById,
  )
    .sort(([, leftChild], [, rightChild]) =>
      leftChild.name.localeCompare(rightChild.name),
    )
    .map(([childId, child]) => {
      const localPoints =
        localProjection.head.childrenById[childId]?.points ?? 0;
      const remotePoints =
        remoteProjection.head.childrenById[childId]?.points ?? 0;
      const reconciliation = reconciliationsByChildId.get(childId);

      return {
        basePoints: reconciliation?.basePoints ?? 0,
        change: localChildIds.has(childId)
          ? ('unchanged' as const)
          : ('added' as const),
        childId,
        childName: child.name,
        localNewContributionPoints: reconciliation?.leftDelta ?? localPoints,
        points: child.points,
        remoteNewContributionPoints: reconciliation?.rightDelta ?? remotePoints,
      };
    });
  const removedChildren = [...localChildIds]
    .filter((childId) => !mergedChildIds.has(childId))
    .map((childId) => {
      const localChild = localProjection.head.childrenById[childId];
      const remoteChild = remoteProjection.head.childrenById[childId];

      if (!localChild) {
        return null;
      }

      return {
        basePoints: localChild.points,
        change: 'removed' as const,
        childId,
        childName: localChild.name,
        localNewContributionPoints: 0,
        points: localChild.points,
        remoteNewContributionPoints:
          (remoteChild?.points ?? 0) - localChild.points,
      };
    })
    .filter(Boolean) as SyncReviewChildRow[];

  return [...mergedChildren, ...removedChildren];
}

function resolveReviewOutcome(args: {
  bundle: SyncBundle;
  localProjection: SyncProjection;
  remoteProjection: SyncProjection;
}): Pick<SyncReviewModel, 'outcome' | 'outcomeCopy'> {
  const { bundle, localProjection, remoteProjection } = args;

  if (bundle.mode === 'merged') {
    return {
      outcome: 'merged',
      outcomeCopy: 'The histories of both devices have been merged.',
    };
  }

  if (
    localProjection.entries.length === 0 &&
    remoteProjection.entries.length > 0
  ) {
    return {
      outcome: 'incoming-bootstrap',
      outcomeCopy: "The other device's history has been synced to your device.",
    };
  }

  return {
    outcome: 'outgoing-bootstrap',
    outcomeCopy: 'Your history has been synced to the other device.',
  };
}

export function buildSyncReviewModel(args: {
  bundle: SyncBundle;
  localDeviceId: string;
  localProjection: SyncProjection;
  remoteProjection: SyncProjection;
}): SyncReviewModel {
  const { bundle, localDeviceId, localProjection, remoteProjection } = args;
  const outcome = resolveReviewOutcome({
    bundle,
    localProjection,
    remoteProjection,
  });

  return {
    ...outcome,
    children: buildReviewChildren({
      bundle,
      localProjection,
      mergedHead: bundle.mergedHead,
      remoteProjection,
    }),
    transactions: buildReviewTransactionItems({
      bundle,
      localDeviceId,
      localProjection,
      remoteProjection,
    }),
  };
}
