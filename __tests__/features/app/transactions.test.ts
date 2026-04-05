import { describe, expect, it } from '@jest/globals';

import {
  canRestoreTransaction,
  canRevertTransaction,
  commitSharedTransaction,
  createDefaultAppDocument,
  createTransactionSyncSnapshot,
  getRestorePlan,
  getRevertPlan,
  reconcileTransactionDocuments,
  restoreTransaction,
  revertTransaction,
} from '../../../src/features/app/transactions';

describe('transactions', () => {
  it('collapses contiguous tap point adjustments into one visible thread', () => {
    let document = withDeviceId(createDefaultAppDocument(), 'device-a');

    document = commitSharedTransaction(
      document,
      { type: 'addChild', name: 'Ava' },
      { actorDeviceName: 'Parent Phone', occurredAt: 100 },
    );

    const childId = document.head.children[0]?.id ?? '';

    document = commitSharedTransaction(
      document,
      { type: 'incrementPoints', amount: 1, childId },
      { actorDeviceName: 'Parent Phone', occurredAt: 101 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'incrementPoints', amount: 1, childId },
      { actorDeviceName: 'Parent Phone', occurredAt: 102 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'incrementPoints', amount: 1, childId },
      { actorDeviceName: 'Parent Phone', occurredAt: 103 },
    );

    expect(document.head.children[0]?.points).toBe(3);
    expect(document.transactionState.events).toHaveLength(4);
    expect(document.transactionState.transactions).toHaveLength(2);
    expect(document.transactionState.transactions[1]?.forward).toMatchObject({
      childId,
      delta: 3,
      nextPoints: 3,
      previousPoints: 0,
      source: 'tap',
      type: 'child-points-adjusted',
    });
  });

  it('starts a new visible point thread when the direction or child changes', () => {
    let document = withDeviceId(createDefaultAppDocument(), 'device-a');

    document = commitSharedTransaction(
      document,
      { type: 'addChild', name: 'Ava' },
      { actorDeviceName: 'Parent Phone', occurredAt: 100 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'addChild', name: 'Noah' },
      { actorDeviceName: 'Parent Phone', occurredAt: 110 },
    );

    const [avaId, noahId] = document.head.children.map((child) => child.id);

    document = commitSharedTransaction(
      document,
      { type: 'incrementPoints', amount: 1, childId: avaId },
      { actorDeviceName: 'Parent Phone', occurredAt: 120 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'decrementPoints', amount: 1, childId: avaId },
      { actorDeviceName: 'Parent Phone', occurredAt: 121 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'incrementPoints', amount: 1, childId: noahId },
      { actorDeviceName: 'Parent Phone', occurredAt: 122 },
    );

    expect(
      document.transactionState.transactions.filter(
        (transaction) => transaction.kind === 'child-points-adjusted',
      ),
    ).toHaveLength(3);
  });

  it('records timer start, pause, and reset as tracked-only threads', () => {
    let document = withDeviceId(createDefaultAppDocument(), 'device-a');

    document = commitSharedTransaction(
      document,
      { type: 'startTimer', startedAt: 1_000 },
      { actorDeviceName: 'Tablet', occurredAt: 1_000 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'pauseTimer', pausedAt: 61_000 },
      { actorDeviceName: 'Tablet', occurredAt: 61_000 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'resetTimer' },
      { actorDeviceName: 'Tablet', occurredAt: 62_000 },
    );

    expect(
      document.transactionState.transactions.map((transaction) => ({
        kind: transaction.kind,
        undoPolicy: transaction.undoPolicy,
      })),
    ).toEqual([
      {
        kind: 'timer-started',
        undoPolicy: 'tracked_only',
      },
      {
        kind: 'timer-paused',
        undoPolicy: 'tracked_only',
      },
      {
        kind: 'timer-reset',
        undoPolicy: 'tracked_only',
      },
    ]);
  });

  it('allows reverting an old point thread without reverting later point threads', () => {
    let document = withDeviceId(createDefaultAppDocument(), 'device-a');

    document = commitSharedTransaction(
      document,
      { type: 'addChild', name: 'Ava' },
      { actorDeviceName: 'Parent Phone', occurredAt: 100 },
    );

    const childId = document.head.children[0]?.id ?? '';

    document = commitSharedTransaction(
      document,
      { type: 'incrementPoints', amount: 1, childId },
      { actorDeviceName: 'Parent Phone', occurredAt: 101 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'renameChild', childId, name: 'Rowan' },
      { actorDeviceName: 'Parent Phone', occurredAt: 102 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'incrementPoints', amount: 1, childId },
      { actorDeviceName: 'Parent Phone', occurredAt: 103 },
    );

    const originalPointThreadId =
      document.transactionState.transactions[1]?.threadId ?? '';
    const laterPointThreadId =
      document.transactionState.transactions[3]?.threadId ?? '';

    expect(
      getRevertPlan(document.transactionState, originalPointThreadId),
    ).toEqual({
      target: document.transactionState.transactions[1],
      transactionIds: [originalPointThreadId],
    });

    document = revertTransaction(document, originalPointThreadId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 104,
    });

    expect(document.head.children[0]?.points).toBe(1);
    expect(
      document.transactionState.transactions.find(
        (transaction) => transaction.threadId === laterPointThreadId,
      )?.status,
    ).toBe('applied');
  });

  it('reverting child add pulls later child-targeted threads into the chain', () => {
    let document = withDeviceId(createDefaultAppDocument(), 'device-a');

    document = commitSharedTransaction(
      document,
      { type: 'addChild', name: 'Ava' },
      { actorDeviceName: 'Parent Phone', occurredAt: 100 },
    );
    const childId = document.head.children[0]?.id ?? '';
    document = commitSharedTransaction(
      document,
      { type: 'renameChild', childId, name: 'Rowan' },
      { actorDeviceName: 'Parent Phone', occurredAt: 101 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'incrementPoints', amount: 1, childId },
      { actorDeviceName: 'Parent Phone', occurredAt: 102 },
    );

    const addThreadId =
      document.transactionState.transactions[0]?.threadId ?? '';
    const plan = getRevertPlan(document.transactionState, addThreadId);

    expect(plan.transactionIds).toEqual([
      document.transactionState.transactions[2]?.threadId,
      document.transactionState.transactions[1]?.threadId,
      addThreadId,
    ]);

    document = revertTransaction(document, addThreadId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 103,
    });

    expect(document.head.children).toEqual([]);
    expect(
      document.transactionState.transactions
        .slice(0, 3)
        .every((transaction) => transaction.status === 'reverted'),
    ).toBe(true);
  });

  it('restoring a reverted thread reapplies the original chain', () => {
    let document = withDeviceId(createDefaultAppDocument(), 'device-a');

    document = commitSharedTransaction(
      document,
      { type: 'addChild', name: 'Ava' },
      { actorDeviceName: 'Parent Phone', occurredAt: 100 },
    );
    const childId = document.head.children[0]?.id ?? '';
    document = commitSharedTransaction(
      document,
      { type: 'incrementPoints', amount: 1, childId },
      { actorDeviceName: 'Parent Phone', occurredAt: 101 },
    );

    const pointThreadId =
      document.transactionState.transactions[1]?.threadId ?? '';

    document = revertTransaction(document, pointThreadId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 102,
    });

    expect(getRestorePlan(document.transactionState, pointThreadId)).toEqual({
      target: document.transactionState.transactions[1],
      transactionIds: [pointThreadId],
    });

    document = restoreTransaction(document, pointThreadId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 103,
    });

    expect(document.head.children[0]?.points).toBe(1);
    expect(
      document.transactionState.transactions.find(
        (transaction) => transaction.threadId === pointThreadId,
      )?.status,
    ).toBe('applied');
    expect(
      document.transactionState.transactions
        .find((transaction) => transaction.threadId === pointThreadId)
        ?.activity.at(-1)?.kind,
    ).toBe('restore');
  });

  it('restoring a reverted middle thread restores only required dependencies', () => {
    let document = withDeviceId(createDefaultAppDocument(), 'device-a');

    document = commitSharedTransaction(
      document,
      { type: 'addChild', name: 'Ava' },
      { actorDeviceName: 'Parent Phone', occurredAt: 100 },
    );

    const childId = document.head.children[0]?.id ?? '';

    document = commitSharedTransaction(
      document,
      { type: 'archiveChild', childId, archivedAt: 101 },
      { actorDeviceName: 'Parent Phone', occurredAt: 101 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'restoreChild', childId },
      { actorDeviceName: 'Parent Phone', occurredAt: 102 },
    );
    document = commitSharedTransaction(
      document,
      { type: 'incrementPoints', amount: 1, childId },
      { actorDeviceName: 'Parent Phone', occurredAt: 103 },
    );

    const addThreadId =
      document.transactionState.transactions[0]?.threadId ?? '';
    const archiveThreadId =
      document.transactionState.transactions[1]?.threadId ?? '';
    const restoreChildThreadId =
      document.transactionState.transactions[2]?.threadId ?? '';
    const pointThreadId =
      document.transactionState.transactions[3]?.threadId ?? '';

    document = revertTransaction(document, addThreadId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 104,
    });

    expect(
      getRestorePlan(document.transactionState, restoreChildThreadId),
    ).toEqual({
      target: document.transactionState.transactions[2],
      transactionIds: [restoreChildThreadId, archiveThreadId, addThreadId],
    });

    document = restoreTransaction(document, restoreChildThreadId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 105,
    });

    expect(document.head.children).toHaveLength(1);
    expect(document.head.children[0]).toMatchObject({
      displayName: 'Ava',
      isArchived: false,
      points: 0,
    });
    expect(
      document.transactionState.transactions.find(
        (transaction) => transaction.threadId === pointThreadId,
      )?.status,
    ).toBe('reverted');
    expect(
      document.transactionState.transactions.find(
        (transaction) => transaction.threadId === restoreChildThreadId,
      )?.status,
    ).toBe('applied');
  });

  it('supersedes older child lifecycle threads when a newer lifecycle action exists', () => {
    let document = withDeviceId(createDefaultAppDocument(), 'device-a');

    document = commitSharedTransaction(
      document,
      { type: 'addChild', name: 'Ava' },
      { actorDeviceName: 'Parent Phone', occurredAt: 100 },
    );

    const childId = document.head.children[0]?.id ?? '';

    document = commitSharedTransaction(
      document,
      { type: 'archiveChild', childId, archivedAt: 101 },
      { actorDeviceName: 'Parent Phone', occurredAt: 101 },
    );

    const firstArchiveThreadId =
      document.transactionState.transactions[1]?.threadId ?? '';

    document = revertTransaction(document, firstArchiveThreadId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 102,
    });
    document = commitSharedTransaction(
      document,
      { type: 'archiveChild', childId, archivedAt: 103 },
      { actorDeviceName: 'Parent Phone', occurredAt: 103 },
    );

    const secondArchiveThreadId =
      document.transactionState.transactions[2]?.threadId ?? '';
    const firstArchive = document.transactionState.transactions.find(
      (transaction) => transaction.threadId === firstArchiveThreadId,
    );
    const secondArchive = document.transactionState.transactions.find(
      (transaction) => transaction.threadId === secondArchiveThreadId,
    );

    expect(firstArchive).toBeDefined();
    expect(secondArchive).toBeDefined();
    expect(firstArchive?.supersededByThreadId).toBe(secondArchiveThreadId);
    expect(secondArchive?.supersededByThreadId).toBeNull();
    if (!firstArchive || !secondArchive) {
      throw new Error('Expected lifecycle archive transactions to exist');
    }

    expect(canRestoreTransaction(firstArchive)).toBe(false);
    expect(canRevertTransaction(firstArchive)).toBe(false);
    expect(canRevertTransaction(secondArchive)).toBe(true);

    document = revertTransaction(document, secondArchiveThreadId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 104,
    });

    expect(document.head.children[0]).toMatchObject({
      displayName: 'Ava',
      isArchived: false,
    });
    expect(
      document.transactionState.transactions.find(
        (transaction) => transaction.threadId === firstArchiveThreadId,
      )?.status,
    ).toBe('reverted');
  });

  it('reconciles divergent client histories into the same canonical hash', () => {
    let deviceA = withDeviceId(createDefaultAppDocument(), 'device-a');
    let deviceB = withDeviceId(createDefaultAppDocument(), 'device-b');

    deviceA = commitSharedTransaction(
      deviceA,
      { type: 'addChild', name: 'Ava' },
      { actorDeviceName: 'Phone A', occurredAt: 100 },
    );

    deviceB = reconcileTransactionDocuments(deviceB, [
      createTransactionSyncSnapshot(deviceA.transactionState),
    ]).document;

    const childId = deviceA.head.children[0]?.id ?? '';

    deviceA = commitSharedTransaction(
      deviceA,
      { type: 'incrementPoints', amount: 1, childId },
      { actorDeviceName: 'Phone A', occurredAt: 200 },
    );
    deviceB = commitSharedTransaction(
      deviceB,
      { type: 'setPoints', childId, points: 10 },
      { actorDeviceName: 'Phone B', occurredAt: 200 },
    );

    const mergedA = reconcileTransactionDocuments(deviceA, [
      createTransactionSyncSnapshot(deviceB.transactionState),
    ]).document;
    const mergedB = reconcileTransactionDocuments(deviceB, [
      createTransactionSyncSnapshot(deviceA.transactionState),
    ]).document;

    expect(mergedA.transactionState.canonicalHash).toBe(
      mergedB.transactionState.canonicalHash,
    );
    expect(mergedA.transactionState.headHash).toBe(
      mergedB.transactionState.headHash,
    );
    expect(mergedA.head.children).toEqual(mergedB.head.children);
    expect(mergedA.head.children[0]?.points).toBe(10);
  });

  it('reconciles concurrent revert and dependent child updates deterministically', () => {
    let deviceA = withDeviceId(createDefaultAppDocument(), 'device-a');
    let deviceB = withDeviceId(createDefaultAppDocument(), 'device-b');

    deviceA = commitSharedTransaction(
      deviceA,
      { type: 'addChild', name: 'Ava' },
      { actorDeviceName: 'Phone A', occurredAt: 100 },
    );

    const bootstrap = createTransactionSyncSnapshot(deviceA.transactionState);
    deviceB = reconcileTransactionDocuments(deviceB, [bootstrap]).document;

    const childId = deviceA.head.children[0]?.id ?? '';
    const addThreadId =
      deviceA.transactionState.transactions[0]?.threadId ?? '';

    deviceA = revertTransaction(deviceA, addThreadId, {
      actorDeviceName: 'Phone A',
      occurredAt: 200,
    });
    deviceB = commitSharedTransaction(
      deviceB,
      { type: 'incrementPoints', amount: 1, childId },
      { actorDeviceName: 'Phone B', occurredAt: 200 },
    );

    const mergedA = reconcileTransactionDocuments(deviceA, [
      createTransactionSyncSnapshot(deviceB.transactionState),
    ]).document;
    const mergedB = reconcileTransactionDocuments(deviceB, [
      createTransactionSyncSnapshot(deviceA.transactionState),
    ]).document;

    expect(mergedA.transactionState.canonicalHash).toBe(
      mergedB.transactionState.canonicalHash,
    );
    expect(mergedA.head.children).toEqual([]);
    expect(
      mergedA.transactionState.transactions.find(
        (transaction) =>
          transaction.kind === 'child-points-adjusted' &&
          transaction.forward.type === 'child-points-adjusted' &&
          transaction.forward.childId === childId,
      )?.status,
    ).toBe('reverted');
  });
});

function withDeviceId<T extends ReturnType<typeof createDefaultAppDocument>>(
  document: T,
  deviceId: string,
) {
  return {
    ...document,
    transactionState: {
      ...document.transactionState,
      clientState: {
        deviceId,
        nextDeviceSequence: 1,
      },
    },
  };
}
