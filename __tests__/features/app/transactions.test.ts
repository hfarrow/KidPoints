import { describe, expect, it } from '@jest/globals';

import {
  canRestoreTransaction,
  commitSharedTransaction,
  createDefaultAppDocument,
  createTransactionSyncSnapshot,
  getRestorePreview,
  reconcileTransactionDocuments,
  restoreTransaction,
} from '../../../src/features/app/transactions';

describe('transactions', () => {
  it('collapses contiguous tap point adjustments into one visible action row', () => {
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
    expect(document.transactionState.transactions[1]).toMatchObject({
      forward: {
        childId,
        delta: 3,
        nextPoints: 3,
        previousPoints: 0,
        source: 'tap',
        type: 'child-points-adjusted',
      },
      rowKind: 'action',
    });
  });

  it('restoring to an older action rolls back newer actions and appends a restore row', () => {
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

    const originalPointRow = document.transactionState.transactions[1];

    if (!originalPointRow || originalPointRow.rowKind !== 'action') {
      throw new Error('Expected point restore row');
    }

    expect(
      getRestorePreview(
        document.transactionState,
        originalPointRow.latestEventId,
      ),
    ).toMatchObject({
      affectedActionEventIds: expect.any(Array),
      isReachable: true,
      mode: 'backward',
      target: originalPointRow,
    });

    document = restoreTransaction(document, originalPointRow.latestEventId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 104,
    });

    expect(document.head.children[0]).toMatchObject({
      displayName: 'Ava',
      points: 1,
    });
    expect(document.transactionState.transactions.at(-1)).toMatchObject({
      kind: 'restore-event',
      rowKind: 'restore',
      targetActionEventId: originalPointRow.latestEventId,
    });
    const currentOriginalPointRow = document.transactionState.transactions.find(
      (
        transaction,
      ): transaction is Extract<
        (typeof document.transactionState.transactions)[number],
        { rowKind: 'action' }
      > =>
        transaction.rowKind === 'action' &&
        transaction.latestEventId === originalPointRow.latestEventId,
    );

    expect(currentOriginalPointRow?.isCurrent).toBe(true);
  });

  it('allows restoring forward before divergence and blocks it after a new action', () => {
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

    const originalPointRow = document.transactionState.transactions[1];
    const laterPointRow = document.transactionState.transactions[3];

    if (
      !originalPointRow ||
      originalPointRow.rowKind !== 'action' ||
      !laterPointRow ||
      laterPointRow.rowKind !== 'action'
    ) {
      throw new Error('Expected action restore rows');
    }

    document = restoreTransaction(document, originalPointRow.latestEventId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 104,
    });

    expect(
      getRestorePreview(document.transactionState, laterPointRow.latestEventId),
    ).toMatchObject({
      isReachable: true,
      mode: 'forward',
    });

    document = restoreTransaction(document, laterPointRow.latestEventId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 105,
    });

    expect(document.head.children[0]).toMatchObject({
      displayName: 'Rowan',
      points: 2,
    });

    document = restoreTransaction(document, originalPointRow.latestEventId, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 106,
    });
    document = commitSharedTransaction(
      document,
      { type: 'renameChild', childId, name: 'Noah' },
      { actorDeviceName: 'Parent Phone', occurredAt: 107 },
    );

    expect(
      getRestorePreview(document.transactionState, laterPointRow.latestEventId),
    ).toMatchObject({
      affectedActionEventIds: [],
      isReachable: false,
      mode: null,
    });
    const updatedLaterPointRow = document.transactionState.transactions.find(
      (
        transaction,
      ): transaction is Extract<
        (typeof document.transactionState.transactions)[number],
        { rowKind: 'action' }
      > =>
        transaction.rowKind === 'action' &&
        transaction.latestEventId === laterPointRow.latestEventId,
    );

    expect(updatedLaterPointRow).toBeDefined();
    expect(
      canRestoreTransaction(updatedLaterPointRow ?? originalPointRow),
    ).toBe(false);
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
