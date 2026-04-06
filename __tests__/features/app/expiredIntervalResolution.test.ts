import { describe, expect, it } from '@jest/globals';

import {
  buildResetTimerDocument,
  resolveExpiredInterval,
} from '../../../src/features/app/expiredIntervalResolution';
import {
  commitSharedTransaction,
  createDefaultAppDocument,
} from '../../../src/features/app/transactions';

describe('resolveExpiredInterval', () => {
  it('restarts the next interval after awarding a child even when transaction replay revives the stale pre-expiry timer', () => {
    let document = withDeviceId(createDefaultAppDocument(), 'device-a');

    document = commitSharedTransaction(
      document,
      { type: 'addChild', name: 'Ava' },
      { actorDeviceName: 'Parent Phone', occurredAt: 100 },
    );

    const childId = document.head.children[0]?.id ?? '';

    document = commitSharedTransaction(
      document,
      { type: 'startTimer', startedAt: 1_000 },
      { actorDeviceName: 'Parent Phone', occurredAt: 1_000 },
    );

    const expiredDocument = {
      ...document,
      head: {
        ...document.head,
        expiredIntervals: [
          {
            childActions: [
              {
                childId,
                childName: 'Ava',
                status: 'pending' as const,
              },
            ],
            intervalId: 'interval-1',
            notificationId: 5001,
            sessionId: document.head.timerRuntimeState.sessionId ?? 'session-1',
            triggeredAt: 16_000,
          },
        ],
        timerRuntimeState: {
          ...document.head.timerRuntimeState,
          lastTriggeredAt: 16_000,
          nextTriggerAt: null,
        },
        timerState: {
          cycleStartedAt: null,
          isRunning: false,
          pausedRemainingMs: null,
        },
      },
    };

    const replayedPointsDocument = commitSharedTransaction(
      expiredDocument,
      { type: 'incrementPoints', amount: 1, childId },
      { actorDeviceName: 'Parent Phone', occurredAt: 17_000 },
    );

    expect(replayedPointsDocument.head.timerState.isRunning).toBe(true);

    const resolved = resolveExpiredInterval(expiredDocument, {
      actorDeviceName: 'Parent Phone',
      childId,
      intervalId: 'interval-1',
      occurredAt: 17_000,
      status: 'awarded',
    });

    expect(resolved.shouldRestartTimer).toBe(true);
    expect(resolved.document.head.children[0]?.points).toBe(1);
    expect(resolved.document.head.expiredIntervals).toEqual([]);
    expect(resolved.document.head.timerState).toEqual({
      cycleStartedAt: 17_000,
      isRunning: true,
      pausedRemainingMs: null,
    });
    expect(resolved.document.head.timerRuntimeState.nextTriggerAt).toBe(
      17_000 + 15 * 60_000,
    );
  });

  it('restarts the next interval after dismissing a child while preserving unresolved expired intervals', () => {
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
      { type: 'startTimer', startedAt: 1_000 },
      { actorDeviceName: 'Parent Phone', occurredAt: 1_000 },
    );

    const expiredDocument = {
      ...document,
      head: {
        ...document.head,
        expiredIntervals: [
          {
            childActions: [
              {
                childId: avaId,
                childName: 'Ava',
                status: 'pending' as const,
              },
              {
                childId: noahId,
                childName: 'Noah',
                status: 'pending' as const,
              },
            ],
            intervalId: 'interval-1',
            notificationId: 5001,
            sessionId: document.head.timerRuntimeState.sessionId ?? 'session-1',
            triggeredAt: 16_000,
          },
        ],
        timerRuntimeState: {
          ...document.head.timerRuntimeState,
          lastTriggeredAt: 16_000,
          nextTriggerAt: null,
        },
        timerState: {
          cycleStartedAt: null,
          isRunning: false,
          pausedRemainingMs: null,
        },
      },
    };

    const resolved = resolveExpiredInterval(expiredDocument, {
      actorDeviceName: 'Parent Phone',
      childId: avaId,
      intervalId: 'interval-1',
      occurredAt: 17_000,
      status: 'dismissed',
    });

    expect(resolved.shouldRestartTimer).toBe(true);
    expect(resolved.document.head.timerState).toEqual({
      cycleStartedAt: 17_000,
      isRunning: true,
      pausedRemainingMs: null,
    });
    expect(resolved.document.head.expiredIntervals).toEqual([
      {
        childActions: [
          {
            childId: avaId,
            childName: 'Ava',
            status: 'dismissed',
          },
          {
            childId: noahId,
            childName: 'Noah',
            status: 'pending',
          },
        ],
        intervalId: 'interval-1',
        notificationId: 5001,
        sessionId: document.head.timerRuntimeState.sessionId ?? 'session-1',
        triggeredAt: 16_000,
      },
    ]);
  });

  it('clears expired intervals and resets the timer even when transaction replay still thinks the old run exists', () => {
    let document = withDeviceId(createDefaultAppDocument(), 'device-a');

    document = commitSharedTransaction(
      document,
      { type: 'addChild', name: 'Ava' },
      { actorDeviceName: 'Parent Phone', occurredAt: 100 },
    );

    document = commitSharedTransaction(
      document,
      { type: 'startTimer', startedAt: 1_000 },
      { actorDeviceName: 'Parent Phone', occurredAt: 1_000 },
    );

    const expiredDocument = {
      ...document,
      head: {
        ...document.head,
        expiredIntervals: [
          {
            childActions: [
              {
                childId: document.head.children[0]?.id ?? 'child-1',
                childName: 'Ava',
                status: 'pending' as const,
              },
            ],
            intervalId: 'interval-1',
            notificationId: 5001,
            sessionId: document.head.timerRuntimeState.sessionId ?? 'session-1',
            triggeredAt: 16_000,
          },
        ],
        timerRuntimeState: {
          ...document.head.timerRuntimeState,
          lastTriggeredAt: 16_000,
          nextTriggerAt: null,
        },
        timerState: {
          cycleStartedAt: null,
          isRunning: false,
          pausedRemainingMs: null,
        },
      },
    };

    const resetDocument = buildResetTimerDocument(expiredDocument, {
      actorDeviceName: 'Parent Phone',
      occurredAt: 17_000,
    });

    expect(resetDocument.head.timerState).toEqual({
      cycleStartedAt: null,
      isRunning: false,
      pausedRemainingMs: null,
    });
    expect(resetDocument.head.timerRuntimeState).toEqual({
      sessionId: null,
      nextTriggerAt: null,
      lastTriggeredAt: null,
    });
    expect(resetDocument.head.expiredIntervals).toEqual([]);
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
