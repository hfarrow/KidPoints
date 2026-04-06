import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { appRepository } from '../../../src/features/app/repository';
import { createDefaultAppData } from '../../../src/features/app/state';
import { createDefaultAppDocument } from '../../../src/features/app/transactions';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockAsyncStorage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

describe('appRepository', () => {
  beforeEach(() => {
    mockAsyncStorage.getItem.mockReset();
    mockAsyncStorage.setItem.mockReset();
  });

  it('defaults the theme preference to system when storage is empty', async () => {
    mockAsyncStorage.getItem.mockImplementation(async () => null);

    const loaded = await appRepository.load();

    expect(loaded.head.uiPreferences.themeMode).toBe('system');
    expect(loaded.head.timerRuntimeState).toEqual({
      sessionId: null,
      nextTriggerAt: null,
      lastTriggeredAt: null,
    });
    expect(loaded.head.timerConfig.intervalSeconds).toBe(0);
    expect(loaded.head.expiredIntervals).toEqual([]);
    expect(loaded.transactionState.transactions).toEqual([]);
    expect(loaded.transactionState.events).toEqual([]);
    expect(loaded.transactionState.clientState.deviceId).toContain('device-');
  });

  it('defaults ui preferences when storage does not include them', async () => {
    mockAsyncStorage.getItem.mockImplementation(async () =>
      JSON.stringify({
        children: [],
        parentSettings: {
          pin: '0000',
        },
      }),
    );

    const loaded = await appRepository.load();

    expect(loaded.head.uiPreferences.themeMode).toBe('system');
    expect(loaded.head.timerConfig.intervalSeconds).toBe(0);
  });

  it('migrates legacy snapshot-only storage into a document with empty sync state', async () => {
    mockAsyncStorage.getItem.mockImplementation(async () =>
      JSON.stringify({
        ...createDefaultAppData(),
        children: [
          {
            archivedAt: null,
            avatarColor: '#93c5fd',
            displayName: 'Ava',
            id: 'child-1',
            isArchived: false,
            points: 5,
            sortOrder: 0,
          },
        ],
      }),
    );

    const loaded = await appRepository.load();

    expect(loaded.head.children[0]?.displayName).toBe('Ava');
    expect(loaded.transactionState.events).toEqual([]);
    expect(loaded.transactionState.transactions).toEqual([]);
    expect(loaded.transactionState.clientState.nextDeviceSequence).toBe(1);
  });

  it('migrates legacy transaction documents into immutable events and derived threads', async () => {
    mockAsyncStorage.getItem.mockImplementation(async () =>
      JSON.stringify({
        head: createDefaultAppData(),
        transactionState: {
          nextTransactionId: 3,
          transactions: [
            {
              actorDeviceName: 'Parent Phone',
              dependsOnTransactionIds: [],
              entityRefs: ['child:child-1'],
              forward: {
                childId: 'child-1',
                childName: 'Ava',
                delta: 1,
                nextPoints: 1,
                previousPoints: 0,
                source: 'tap',
                type: 'child-points-adjusted',
              },
              id: 1,
              kind: 'child-points-adjusted',
              occurredAt: 100,
              rootTransactionId: 1,
              undoPolicy: 'reversible',
            },
            {
              actorDeviceName: 'Parent Phone',
              dependsOnTransactionIds: [1],
              entityRefs: ['child:child-1'],
              forward: {
                targetRootTransactionIds: [1],
                type: 'revert-chain',
              },
              id: 2,
              kind: 'revert-chain',
              occurredAt: 101,
              rootTransactionId: 1,
              undoPolicy: 'tracked_only',
            },
          ],
        },
        version: 3,
      }),
    );

    const loaded = await appRepository.load();

    expect(loaded.version).toBe(4);
    expect(loaded.transactionState.events).toHaveLength(2);
    expect(loaded.transactionState.transactions).toHaveLength(1);
    expect(loaded.transactionState.transactions[0]).toMatchObject({
      id: 1,
      status: 'reverted',
      undoPolicy: 'reversible',
    });
    expect(loaded.transactionState.canonicalHash).toContain('h');
    expect(loaded.transactionState.headHash).toContain('h');
  });

  it('persists the selected theme mode', async () => {
    const nextData = createDefaultAppDocument();
    nextData.head = {
      ...createDefaultAppData(),
      uiPreferences: {
        themeMode: 'dark' as const,
      },
    };

    mockAsyncStorage.setItem.mockImplementation(async () => null);

    await appRepository.save(nextData);

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      'kidpoints.app-data.v1',
      expect.stringContaining('"themeMode":"dark"'),
    );
  });

  it('preserves authoritative stopped timer state from the persisted head on cold start', async () => {
    const storedDocument = createDefaultAppDocument();

    storedDocument.head = {
      ...storedDocument.head,
      expiredIntervals: [],
      timerRuntimeState: {
        lastTriggeredAt: 16_000,
        nextTriggerAt: null,
        sessionId: 'session-1',
      },
      timerState: {
        cycleStartedAt: null,
        isRunning: false,
        pausedRemainingMs: null,
      },
    };
    storedDocument.transactionState.events = [
      {
        actorDeviceName: 'Parent Phone',
        dependsOnThreadIds: [],
        deviceId: 'device-a',
        deviceSequence: 1,
        entityRefs: ['timer:shared'],
        eventHash: 'hash-1',
        eventId: 'evt:device-a:00000001',
        eventKind: 'action',
        mutation: {
          nextTimerState: {
            cycleStartedAt: 1_000,
            isRunning: true,
            pausedRemainingMs: null,
          },
          startedAt: 1_000,
          type: 'timer-started',
        },
        occurredAt: 1_000,
        threadId: 'thr:device-a:00000001',
        undoPolicy: 'tracked_only',
      },
    ];

    mockAsyncStorage.getItem.mockImplementation(async () =>
      JSON.stringify(storedDocument),
    );

    const loaded = await appRepository.load();

    expect(loaded.head.timerState).toEqual({
      cycleStartedAt: null,
      isRunning: false,
      pausedRemainingMs: null,
    });
    expect(loaded.head.timerRuntimeState).toEqual({
      lastTriggeredAt: 16_000,
      nextTriggerAt: null,
      sessionId: 'session-1',
    });
    expect(loaded.head.expiredIntervals).toEqual([]);
  });
});
