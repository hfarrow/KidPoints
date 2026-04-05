import { describe, expect, it } from '@jest/globals';

import {
  commitSharedTransaction,
  createDefaultAppDocument,
  getRestorePlan,
  getRevertPlan,
  restoreTransaction,
  revertTransaction,
} from '../../../src/features/app/transactions';

describe('transactions', () => {
  it('merges contiguous tap point adjustments for the same child and direction', () => {
    let document = createDefaultAppDocument();

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

  it('starts a new points transaction when the direction or child changes', () => {
    let document = createDefaultAppDocument();

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

  it('does not merge exact point edits into tap bursts', () => {
    let document = createDefaultAppDocument();

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
      { type: 'setPoints', childId, points: 9 },
      { actorDeviceName: 'Parent Phone', occurredAt: 102 },
    );

    const pointTransactions = document.transactionState.transactions.filter(
      (transaction) => transaction.kind === 'child-points-adjusted',
    );

    expect(pointTransactions).toHaveLength(2);
    expect(pointTransactions[0]?.forward).toMatchObject({
      delta: 1,
      nextPoints: 1,
      previousPoints: 0,
      source: 'tap',
    });
    expect(pointTransactions[1]?.forward).toMatchObject({
      delta: 8,
      nextPoints: 9,
      previousPoints: 1,
      source: 'set',
    });
  });

  it('records timer start, pause, and reset as tracked-only transactions', () => {
    let document = createDefaultAppDocument();

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
        inverse: transaction.inverse,
        kind: transaction.kind,
        undoPolicy: transaction.undoPolicy,
      })),
    ).toEqual([
      {
        inverse: null,
        kind: 'timer-started',
        undoPolicy: 'tracked_only',
      },
      {
        inverse: null,
        kind: 'timer-paused',
        undoPolicy: 'tracked_only',
      },
      {
        inverse: null,
        kind: 'timer-reset',
        undoPolicy: 'tracked_only',
      },
    ]);
  });

  it('allows reverting an old point delta without reverting later point deltas', () => {
    let document = createDefaultAppDocument();

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

    const originalPointTransactionId =
      document.transactionState.transactions[1]?.id ?? 0;
    const laterPointTransactionId =
      document.transactionState.transactions[3]?.id ?? 0;

    expect(
      getRevertPlan(document.transactionState, originalPointTransactionId),
    ).toEqual({
      target: document.transactionState.transactions[1],
      transactionIds: [originalPointTransactionId],
    });

    document = revertTransaction(document, originalPointTransactionId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 104,
    });

    expect(document.head.children[0]?.points).toBe(1);
    expect(
      document.transactionState.transactions.find(
        (transaction) => transaction.id === laterPointTransactionId,
      )?.status,
    ).toBe('applied');
  });

  it('reverting child add pulls later child-targeted transactions into the chain', () => {
    let document = createDefaultAppDocument();

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

    const addTransactionId = document.transactionState.transactions[0]?.id ?? 0;
    const plan = getRevertPlan(document.transactionState, addTransactionId);

    expect(plan.transactionIds).toEqual([3, 2, 1]);

    document = revertTransaction(document, addTransactionId, {
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

  it('restoring a reverted transaction reapplies the original chain', () => {
    let document = createDefaultAppDocument();

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

    const pointTransactionId =
      document.transactionState.transactions[1]?.id ?? 0;

    document = revertTransaction(document, pointTransactionId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 102,
    });

    expect(
      getRestorePlan(document.transactionState, pointTransactionId),
    ).toEqual({
      target: document.transactionState.transactions[1],
      transactionIds: [pointTransactionId],
    });

    document = restoreTransaction(document, pointTransactionId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 103,
    });

    const restoreChainTransactionId =
      document.transactionState.transactions.at(-1)?.id ?? 0;

    expect(document.head.children[0]?.points).toBe(1);
    expect(
      document.transactionState.transactions.find(
        (transaction) => transaction.id === pointTransactionId,
      )?.status,
    ).toBe('applied');
    expect(
      document.transactionState.transactions.find(
        (transaction) => transaction.id === restoreChainTransactionId,
      )?.status,
    ).toBe('applied');
    expect(
      document.transactionState.transactions.find(
        (transaction) => transaction.id === restoreChainTransactionId,
      )?.entryKind,
    ).toBe('restore');
  });
});
