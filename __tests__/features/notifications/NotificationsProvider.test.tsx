import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  NotificationsProvider,
  useNotifications,
} from '../../../src/features/notifications/NotificationsProvider';
import type {
  NotificationDocument,
  PendingNotificationLaunchAction,
} from '../../../src/features/notifications/notificationsModel';
import { ParentSessionProvider } from '../../../src/features/parent/parentSessionContext';
import { AppSettingsProvider } from '../../../src/features/settings/appSettingsContext';
import {
  clearStartupNavigationRequests,
  useStartupNavigationStore,
} from '../../../src/navigation/startupNavigationStore';
import {
  createInitialSharedDocument,
  createSharedStore,
  deriveTransactionRows,
  SharedStoreProvider,
  useSharedStore,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

jest.mock('../../../src/logging/logger', () => {
  const actualLoggerModule = jest.requireActual('../../../src/logging/logger');

  return {
    ...actualLoggerModule,
    createModuleLogger: jest.fn((namespace: string) => ({
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      namespace,
      temp: jest.fn(),
      warn: jest.fn(),
    })),
    logForwardedNativeEntry: jest.fn(),
  };
});

jest.mock('../../../src/features/notifications/nativeNotifications', () => ({
  addNotificationLogListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  addNotificationLaunchActionListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  addNotificationStateChangeListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  consumePendingNotificationLaunchAction: jest.fn(),
  getBufferedNotificationLogs: jest.fn(() => []),
  getNotificationRuntimeStatus: jest.fn(),
  isNotificationsModuleAvailable: jest.fn(() => true),
  loadPersistedNotificationDocument: jest.fn(),
  moveTaskToBack: jest.fn(async () => true),
  openExactAlarmSettings: jest.fn(async () => undefined),
  openFullScreenIntentSettings: jest.fn(async () => undefined),
  openNotificationSettings: jest.fn(async () => undefined),
  openPromotedNotificationSettings: jest.fn(async () => undefined),
  pauseNotificationTimer: jest.fn(async (document: NotificationDocument) =>
    JSON.stringify(document),
  ),
  resetNotificationTimer: jest.fn(async (document: NotificationDocument) =>
    JSON.stringify(document),
  ),
  requestNotificationPermission: jest.fn(async () => true),
  startNotificationTimer: jest.fn(async (document: NotificationDocument) =>
    JSON.stringify(document),
  ),
  stopExpiredAlarmPlayback: jest.fn(async () => undefined),
  syncNotificationDocument: jest.fn(async (document: NotificationDocument) =>
    JSON.stringify(document),
  ),
}));

const {
  addNotificationLogListener: mockAddNotificationLogListener,
  addNotificationLaunchActionListener: mockAddNotificationLaunchActionListener,
  addNotificationStateChangeListener: mockAddNotificationStateChangeListener,
  consumePendingNotificationLaunchAction:
    mockConsumePendingNotificationLaunchAction,
  getBufferedNotificationLogs: mockGetBufferedNotificationLogs,
  getNotificationRuntimeStatus: mockGetNotificationRuntimeStatus,
  loadPersistedNotificationDocument: mockLoadPersistedNotificationDocument,
  moveTaskToBack: mockMoveTaskToBack,
  pauseNotificationTimer: mockPauseNotificationTimer,
  requestNotificationPermission: mockRequestNotificationPermission,
  startNotificationTimer: mockStartNotificationTimer,
  stopExpiredAlarmPlayback: mockStopExpiredAlarmPlayback,
} = jest.requireMock(
  '../../../src/features/notifications/nativeNotifications',
) as {
  addNotificationLogListener: jest.Mock;
  addNotificationLaunchActionListener: jest.Mock;
  addNotificationStateChangeListener: jest.Mock;
  consumePendingNotificationLaunchAction: jest.Mock<
    Promise<PendingNotificationLaunchAction | null>,
    []
  >;
  getBufferedNotificationLogs: jest.Mock;
  getNotificationRuntimeStatus: jest.Mock;
  loadPersistedNotificationDocument: jest.Mock<
    Promise<NotificationDocument | null>,
    []
  >;
  moveTaskToBack: jest.Mock;
  pauseNotificationTimer: jest.Mock;
  requestNotificationPermission: jest.Mock;
  startNotificationTimer: jest.Mock;
  stopExpiredAlarmPlayback: jest.Mock;
};

const {
  createModuleLogger: mockCreateModuleLogger,
  logForwardedNativeEntry: mockLogForwardedNativeEntry,
} = jest.requireMock('../../../src/logging/logger') as {
  createModuleLogger: jest.Mock;
  logForwardedNativeEntry: jest.Mock;
};

function createSharedDocumentFixture(childNames = ['Avery']) {
  const store = createSharedStore({
    initialDocument: createInitialSharedDocument({
      deviceId: 'notifications-provider',
    }),
    storage: createMemoryStorage(),
  });

  childNames.forEach((childName) => {
    store.getState().addChild(childName);
  });

  const document = store.getState().document;
  const childId = document.head.activeChildIds[0] ?? null;
  const childIds = [...document.head.activeChildIds];

  if (!childId) {
    throw new Error('Expected shared store fixture to create an active child');
  }

  return { childId, childIds, document };
}

function createExpiredNotificationDocument(
  childId: string,
): NotificationDocument {
  return {
    head: {
      children: [{ displayName: 'Avery', id: childId, isArchived: false }],
      expiredIntervals: [
        {
          childActions: [{ childId, childName: 'Avery', status: 'pending' }],
          intervalId: 'interval-1',
          notificationId: 5001,
          sessionId: 'session-1',
          triggeredAt: 100,
        },
      ],
      timerConfig: {
        alarmDurationSeconds: 20,
        intervalMinutes: 15,
        intervalSeconds: 0,
        liveCountdownNotificationsEnabled: true,
      },
      timerRuntimeState: {
        lastTriggeredAt: 100,
        nextTriggerAt: null,
        sessionId: 'session-1',
      },
      timerState: {
        activeIntervalMs: null,
        cycleStartedAt: null,
        isRunning: false,
        pausedRemainingMs: null,
      },
    },
    schemaVersion: 1,
  };
}

function createExpiredNotificationDocumentForChildren(
  childActions: {
    childId: string;
    childName: string;
    status: 'awarded' | 'dismissed' | 'pending';
  }[],
): NotificationDocument {
  return {
    head: {
      children: childActions.map(({ childId, childName }) => ({
        displayName: childName,
        id: childId,
        isArchived: false,
      })),
      expiredIntervals: [
        {
          childActions,
          intervalId: 'interval-1',
          notificationId: 5001,
          sessionId: 'session-1',
          triggeredAt: 100,
        },
      ],
      timerConfig: {
        alarmDurationSeconds: 20,
        intervalMinutes: 15,
        intervalSeconds: 0,
        liveCountdownNotificationsEnabled: true,
      },
      timerRuntimeState: {
        lastTriggeredAt: 100,
        nextTriggerAt: null,
        sessionId: 'session-1',
      },
      timerState: {
        activeIntervalMs: null,
        cycleStartedAt: null,
        isRunning: false,
        pausedRemainingMs: null,
      },
    },
    schemaVersion: 1,
  };
}

function createExpiredRunningSharedDocumentFixture(childNames = ['Avery']) {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));

  const store = createSharedStore({
    initialDocument: createInitialSharedDocument({
      deviceId: 'notifications-provider-running',
    }),
    storage: createMemoryStorage(),
  });

  childNames.forEach((childName) => {
    store.getState().addChild(childName);
  });
  store.getState().startTimer();

  jest.setSystemTime(new Date('2026-04-08T12:20:00.000Z'));

  const document = store.getState().document;
  const childId = document.head.activeChildIds[0] ?? null;
  const childIds = [...document.head.activeChildIds];

  if (!childId) {
    throw new Error('Expected running shared store fixture to create a child');
  }

  return { childId, childIds, document };
}

function NotificationsProbe() {
  const {
    activeExpiredTimerSession,
    dismissCheckInFlow,
    isReady,
    resolveExpiredTimerChild,
  } = useNotifications();
  const sharedDocument = useSharedStore((state) => state.document);
  const activeChildIds = sharedDocument.head.activeChildIds;
  const activeChildId = activeChildIds[0] ?? null;
  const secondActiveChildId = activeChildIds[1] ?? null;
  const pauseTimer = useSharedStore((state) => state.pauseTimer);
  const startTimer = useSharedStore((state) => state.startTimer);
  const pointAdjustmentCount = sharedDocument.transactions.filter(
    (transaction) => transaction.kind === 'points-adjusted',
  ).length;
  const groupedCheckInCount = sharedDocument.transactions.filter(
    (transaction) => transaction.groupId != null,
  ).length;
  const pointSnapshot = activeChildIds
    .map((childId) => sharedDocument.head.childrenById[childId]?.points ?? -1)
    .join('|');
  const transactionKinds = deriveTransactionRows(sharedDocument)
    .map((row) => row.kind)
    .join('|');

  return (
    <>
      <Text testID="notifications-ready">{isReady ? 'ready' : 'loading'}</Text>
      <Text testID="points">
        {String(
          activeChildId
            ? (sharedDocument.head.childrenById[activeChildId]?.points ?? -1)
            : -1,
        )}
      </Text>
      <Text testID="timer-mode">{sharedDocument.head.timerState.mode}</Text>
      <Text testID="active-session">
        {activeExpiredTimerSession?.intervalId ?? 'none'}
      </Text>
      <Text testID="points-snapshot">{pointSnapshot}</Text>
      <Text testID="point-adjustment-count">
        {String(pointAdjustmentCount)}
      </Text>
      <Text testID="grouped-check-in-count">{String(groupedCheckInCount)}</Text>
      <Text testID="transaction-kinds">{transactionKinds}</Text>
      <Text
        onPress={() => {
          if (!activeChildId) {
            return;
          }

          void resolveExpiredTimerChild(activeChildId, 'awarded');
        }}
      >
        Award child
      </Text>
      <Text
        onPress={() => {
          if (!activeChildId) {
            return;
          }

          void resolveExpiredTimerChild(activeChildId, 'awarded', {
            restartTimerOnResolve: false,
          });
        }}
      >
        Award child without restart
      </Text>
      <Text
        onPress={() => {
          if (!activeChildId) {
            return;
          }

          void resolveExpiredTimerChild(activeChildId, 'dismissed');
        }}
      >
        Dismiss child
      </Text>
      <Text
        onPress={() => {
          if (!secondActiveChildId) {
            return;
          }

          void resolveExpiredTimerChild(secondActiveChildId, 'awarded');
        }}
      >
        Award child 2
      </Text>
      <Text
        onPress={() => {
          if (!secondActiveChildId) {
            return;
          }

          void resolveExpiredTimerChild(secondActiveChildId, 'dismissed');
        }}
      >
        Dismiss child 2
      </Text>
      <Text
        onPress={() => {
          dismissCheckInFlow();
        }}
      >
        Dismiss flow
      </Text>
      <Text
        onPress={() => {
          pauseTimer();
        }}
      >
        Pause timer
      </Text>
      <Text
        onPress={() => {
          startTimer();
        }}
      >
        Start timer
      </Text>
    </>
  );
}

function renderProvider({
  initialDocument,
  initialLiveCountdownNotificationsEnabled = true,
  initialParentUnlocked = true,
}: {
  initialDocument: ReturnType<typeof createSharedDocumentFixture>['document'];
  initialLiveCountdownNotificationsEnabled?: boolean;
  initialParentUnlocked?: boolean;
}) {
  return render(
    <SharedStoreProvider
      initialDocument={initialDocument}
      storage={createMemoryStorage()}
    >
      <ParentSessionProvider initialParentUnlocked={initialParentUnlocked}>
        <AppSettingsProvider
          initialLiveCountdownNotificationsEnabled={
            initialLiveCountdownNotificationsEnabled
          }
          initialThemeMode="light"
          storage={createMemoryStorage()}
        >
          <NotificationsProvider>
            <NotificationsProbe />
          </NotificationsProvider>
        </AppSettingsProvider>
      </ParentSessionProvider>
    </SharedStoreProvider>,
  );
}

describe('NotificationsProvider', () => {
  let sharedFixture: ReturnType<typeof createSharedDocumentFixture>;

  beforeEach(() => {
    sharedFixture = createSharedDocumentFixture();
    clearStartupNavigationRequests();
    jest.clearAllMocks();
    mockCreateModuleLogger.mockClear();
    mockAddNotificationLogListener.mockReturnValue({
      remove: jest.fn(),
    });
    mockAddNotificationLaunchActionListener.mockReturnValue({
      remove: jest.fn(),
    });
    mockAddNotificationStateChangeListener.mockReturnValue({
      remove: jest.fn(),
    });
    mockConsumePendingNotificationLaunchAction.mockResolvedValue({
      intervalId: 'interval-1',
      notificationId: 5001,
      sessionId: 'session-1',
      triggeredAt: 100,
      type: 'check-in',
    });
    mockGetNotificationRuntimeStatus.mockResolvedValue({
      countdownNotificationChannelImportance: 2,
      countdownNotificationHasPromotableCharacteristics: true,
      countdownNotificationIsOngoing: false,
      countdownNotificationRequestedPromoted: true,
      countdownNotificationUsesChronometer: true,
      countdownNotificationWhen: null,
      exactAlarmPermissionGranted: true,
      expiredNotificationCategory: 'alarm',
      expiredNotificationChannelImportance: 4,
      expiredNotificationHasCustomHeadsUp: true,
      expiredNotificationHasFullScreenIntent: true,
      fullScreenIntentPermissionGranted: true,
      fullScreenIntentSettingsResolvable: true,
      isAppInForeground: true,
      isRunning: false,
      lastTriggeredAt: 100,
      nextTriggerAt: null,
      notificationPermissionGranted: true,
      promotedNotificationPermissionGranted: true,
      promotedNotificationSettingsResolvable: true,
      sessionId: 'session-1',
    });
    mockGetBufferedNotificationLogs.mockReturnValue([]);
    mockRequestNotificationPermission.mockResolvedValue(true);
    mockLoadPersistedNotificationDocument.mockResolvedValue(
      createExpiredNotificationDocument(sharedFixture.childId),
    );
  });

  it('subscribes to native logs before notification initialization completes and replays buffered logs in sequence order', async () => {
    let resolvePersistedDocument:
      | ((document: NotificationDocument | null) => void)
      | undefined;

    mockLoadPersistedNotificationDocument.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePersistedDocument = resolve;
        }),
    );
    mockGetBufferedNotificationLogs.mockReturnValue([
      {
        contextJson: JSON.stringify({ source: 'buffer-late' }),
        level: 'warn',
        message: 'Buffered second',
        sequence: 2,
        tag: 'KidPointsNotificationsIntent',
        timestampMs: 200,
      },
      {
        contextJson: JSON.stringify({ source: 'buffer-early' }),
        level: 'debug',
        message: 'Buffered first',
        sequence: 1,
        tag: 'KidPointsNotifications',
        timestampMs: 100,
      },
    ]);

    renderProvider({
      initialDocument: sharedFixture.document,
      initialParentUnlocked: true,
    });

    expect(screen.getByTestId('notifications-ready').props.children).toBe(
      'loading',
    );
    expect(mockAddNotificationLogListener).toHaveBeenCalledTimes(1);
    expect(mockGetBufferedNotificationLogs).toHaveBeenCalledWith(-1);
    expect(mockLogForwardedNativeEntry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        level: 'debug',
        message: 'Buffered first',
        sequence: 1,
        tag: 'KidPointsNotifications',
        timestampMs: 100,
      }),
      expect.objectContaining({
        source: 'buffer-early',
      }),
    );
    expect(mockLogForwardedNativeEntry).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        level: 'warn',
        message: 'Buffered second',
        sequence: 2,
        tag: 'KidPointsNotificationsIntent',
        timestampMs: 200,
      }),
      expect.objectContaining({
        source: 'buffer-late',
      }),
    );

    await act(async () => {
      resolvePersistedDocument?.(
        createExpiredNotificationDocument(sharedFixture.childId),
      );
    });
  });

  it('dedupes overlapping buffered and live native logs while preserving native metadata', async () => {
    mockAddNotificationLogListener.mockImplementation((listener) => {
      listener({
        contextJson: JSON.stringify({ source: 'live-duplicate' }),
        level: 'info',
        message: 'Live duplicate',
        sequence: 2,
        tag: 'KidPointsNotificationsService',
        timestampMs: 250,
      });
      listener({
        contextJson: JSON.stringify({ source: 'live-new' }),
        level: 'error',
        message: 'Live new',
        sequence: 3,
        tag: 'KidPointsNotificationsService',
        timestampMs: 300,
      });

      return { remove: jest.fn() };
    });
    mockGetBufferedNotificationLogs.mockReturnValue([
      {
        contextJson: JSON.stringify({ source: 'buffer-early' }),
        level: 'debug',
        message: 'Buffered first',
        sequence: 1,
        tag: 'KidPointsNotifications',
        timestampMs: 100,
      },
      {
        contextJson: JSON.stringify({ source: 'buffer-duplicate' }),
        level: 'info',
        message: 'Buffered duplicate',
        sequence: 2,
        tag: 'KidPointsNotificationsService',
        timestampMs: 200,
      },
    ]);

    renderProvider({
      initialDocument: sharedFixture.document,
      initialParentUnlocked: true,
    });

    await waitFor(() =>
      expect(screen.getByTestId('notifications-ready').props.children).toBe(
        'ready',
      ),
    );

    expect(mockLogForwardedNativeEntry).toHaveBeenCalledTimes(3);
    expect(mockLogForwardedNativeEntry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sequence: 1,
        tag: 'KidPointsNotifications',
        timestampMs: 100,
      }),
      expect.objectContaining({
        source: 'buffer-early',
      }),
    );
    expect(mockLogForwardedNativeEntry).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sequence: 2,
        tag: 'KidPointsNotificationsService',
        timestampMs: 200,
      }),
      expect.objectContaining({
        source: 'buffer-duplicate',
      }),
    );
    expect(mockLogForwardedNativeEntry).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        sequence: 3,
        tag: 'KidPointsNotificationsService',
        timestampMs: 300,
      }),
      expect.objectContaining({
        source: 'live-new',
      }),
    );
  });

  it('queues the timer check-in route immediately when the parent is already unlocked', async () => {
    renderProvider({
      initialDocument: sharedFixture.document,
      initialParentUnlocked: true,
    });

    await waitFor(() =>
      expect(screen.getByTestId('notifications-ready').props.children).toBe(
        'ready',
      ),
    );

    await waitFor(() =>
      expect(useStartupNavigationStore.getState().requests).toEqual([
        expect.objectContaining({
          href: '/timer-check-in',
          id: 'notifications-check-in',
          targetPathname: '/timer-check-in',
        }),
      ]),
    );
    expect(mockRequestNotificationPermission).not.toHaveBeenCalled();
  });

  it('restores an unresolved check-in from persisted notification state when no pending launch action remains', async () => {
    try {
      const runningFixture = createExpiredRunningSharedDocumentFixture();
      mockConsumePendingNotificationLaunchAction.mockResolvedValue(null);
      mockLoadPersistedNotificationDocument.mockResolvedValue(
        createExpiredNotificationDocument(runningFixture.childId),
      );

      renderProvider({
        initialDocument: runningFixture.document,
        initialParentUnlocked: true,
      });

      await waitFor(() =>
        expect(screen.getByTestId('notifications-ready').props.children).toBe(
          'ready',
        ),
      );

      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'interval-1',
        ),
      );

      expect(useStartupNavigationStore.getState().requests).toEqual([
        expect.objectContaining({
          href: '/timer-check-in',
          id: 'notifications-check-in',
          targetPathname: '/timer-check-in',
        }),
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores duplicate launch-action events for the same pending check-in', async () => {
    mockConsumePendingNotificationLaunchAction.mockResolvedValue(null);

    renderProvider({
      initialDocument: sharedFixture.document,
      initialParentUnlocked: true,
    });

    await waitFor(() =>
      expect(screen.getByTestId('notifications-ready').props.children).toBe(
        'ready',
      ),
    );

    const launchActionListener =
      mockAddNotificationLaunchActionListener.mock.calls[0]?.[0];

    expect(typeof launchActionListener).toBe('function');

    await act(async () => {
      launchActionListener?.({
        intervalId: 'interval-1',
        notificationId: 5001,
        sessionId: 'session-1',
        triggeredAt: 100,
        type: 'check-in',
      });
      launchActionListener?.({
        intervalId: 'interval-1',
        notificationId: 5001,
        sessionId: 'session-1',
        triggeredAt: 100,
        type: 'check-in',
      });
    });

    expect(mockStopExpiredAlarmPlayback).toHaveBeenCalledTimes(1);
    expect(useStartupNavigationStore.getState().requests).toEqual([
      expect.objectContaining({
        href: '/timer-check-in',
        id: 'notifications-check-in',
        targetPathname: '/timer-check-in',
      }),
    ]);
  });

  it('keeps alarm playback running for full-screen-intent launch actions', async () => {
    mockConsumePendingNotificationLaunchAction.mockResolvedValue(null);

    renderProvider({
      initialDocument: sharedFixture.document,
      initialParentUnlocked: true,
    });

    await waitFor(() =>
      expect(screen.getByTestId('notifications-ready').props.children).toBe(
        'ready',
      ),
    );

    mockStopExpiredAlarmPlayback.mockClear();

    const launchActionListener =
      mockAddNotificationLaunchActionListener.mock.calls[0]?.[0];

    expect(typeof launchActionListener).toBe('function');

    await act(async () => {
      launchActionListener?.({
        intervalId: 'interval-1',
        launchSource: 'full-screen-intent',
        notificationId: 5001,
        sessionId: 'session-1',
        triggeredAt: 100,
        type: 'check-in',
      });
    });

    expect(mockStopExpiredAlarmPlayback).not.toHaveBeenCalled();
    expect(useStartupNavigationStore.getState().requests).toEqual([
      expect.objectContaining({
        href: '/timer-check-in-lock-screen',
        id: 'notifications-check-in',
        targetPathname: '/timer-check-in-lock-screen',
      }),
    ]);
  });

  it('routes notification launch actions to the temporary check-in screen', async () => {
    mockConsumePendingNotificationLaunchAction.mockResolvedValue(null);

    renderProvider({
      initialDocument: sharedFixture.document,
      initialParentUnlocked: true,
    });

    await waitFor(() =>
      expect(screen.getByTestId('notifications-ready').props.children).toBe(
        'ready',
      ),
    );

    const launchActionListener =
      mockAddNotificationLaunchActionListener.mock.calls[0]?.[0];

    await act(async () => {
      launchActionListener?.({
        intervalId: 'interval-1',
        launchSource: 'notification',
        notificationId: 5001,
        sessionId: 'session-1',
        triggeredAt: 100,
        type: 'check-in',
      });
    });

    expect(mockStopExpiredAlarmPlayback).toHaveBeenCalledTimes(1);
    expect(useStartupNavigationStore.getState().requests).toEqual([
      expect.objectContaining({
        href: '/timer-check-in-lock-screen',
        id: 'notifications-check-in',
        targetPathname: '/timer-check-in-lock-screen',
      }),
    ]);
  });

  it('moves the task to the background when a full-screen-intent check-in flow is completed', async () => {
    try {
      const runningFixture = createExpiredRunningSharedDocumentFixture();
      mockConsumePendingNotificationLaunchAction.mockResolvedValue(null);
      mockLoadPersistedNotificationDocument.mockResolvedValue(null);

      renderProvider({
        initialDocument: runningFixture.document,
        initialParentUnlocked: true,
      });

      await waitFor(() =>
        expect(screen.getByTestId('notifications-ready').props.children).toBe(
          'ready',
        ),
      );

      const notificationStateListener =
        mockAddNotificationStateChangeListener.mock.calls[0]?.[0];
      const launchActionListener =
        mockAddNotificationLaunchActionListener.mock.calls[0]?.[0];

      await act(async () => {
        notificationStateListener?.({
          document: createExpiredNotificationDocument(runningFixture.childId),
          reason: 'interval-triggered',
          runtimeStatus: {
            countdownNotificationChannelImportance: 2,
            countdownNotificationHasPromotableCharacteristics: true,
            countdownNotificationIsOngoing: false,
            countdownNotificationRequestedPromoted: true,
            countdownNotificationUsesChronometer: true,
            countdownNotificationWhen: null,
            exactAlarmPermissionGranted: true,
            expiredNotificationCategory: 'alarm',
            expiredNotificationChannelImportance: 4,
            expiredNotificationHasCustomHeadsUp: true,
            expiredNotificationHasFullScreenIntent: true,
            fullScreenIntentPermissionGranted: true,
            fullScreenIntentSettingsResolvable: true,
            isAppInForeground: false,
            isRunning: false,
            lastTriggeredAt: 100,
            nextTriggerAt: null,
            notificationPermissionGranted: true,
            promotedNotificationPermissionGranted: true,
            promotedNotificationSettingsResolvable: true,
            sessionId: 'session-1',
          },
        });
        launchActionListener?.({
          intervalId: 'interval-1',
          launchSource: 'full-screen-intent',
          notificationId: 5001,
          sessionId: 'session-1',
          triggeredAt: 100,
          type: 'check-in',
        });
      });

      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'interval-1',
        ),
      );

      mockMoveTaskToBack.mockClear();

      await act(async () => {
        fireEvent.press(screen.getByText('Award child'));
      });

      await waitFor(() => expect(mockMoveTaskToBack).toHaveBeenCalledTimes(1));
    } finally {
      jest.useRealTimers();
    }
  });

  it('moves the task to the background when a notification check-in flow is completed', async () => {
    try {
      const runningFixture = createExpiredRunningSharedDocumentFixture();
      mockConsumePendingNotificationLaunchAction.mockResolvedValue(null);
      mockLoadPersistedNotificationDocument.mockResolvedValue(null);

      renderProvider({
        initialDocument: runningFixture.document,
        initialParentUnlocked: true,
      });

      await waitFor(() =>
        expect(screen.getByTestId('notifications-ready').props.children).toBe(
          'ready',
        ),
      );

      const notificationStateListener =
        mockAddNotificationStateChangeListener.mock.calls[0]?.[0];
      const launchActionListener =
        mockAddNotificationLaunchActionListener.mock.calls[0]?.[0];

      await act(async () => {
        notificationStateListener?.({
          document: createExpiredNotificationDocument(runningFixture.childId),
          reason: 'interval-triggered',
          runtimeStatus: {
            countdownNotificationChannelImportance: 2,
            countdownNotificationHasPromotableCharacteristics: true,
            countdownNotificationIsOngoing: false,
            countdownNotificationRequestedPromoted: true,
            countdownNotificationUsesChronometer: true,
            countdownNotificationWhen: null,
            exactAlarmPermissionGranted: true,
            expiredNotificationCategory: 'alarm',
            expiredNotificationChannelImportance: 4,
            expiredNotificationHasCustomHeadsUp: true,
            expiredNotificationHasFullScreenIntent: true,
            fullScreenIntentPermissionGranted: true,
            fullScreenIntentSettingsResolvable: true,
            isAppInForeground: false,
            isRunning: false,
            lastTriggeredAt: 100,
            nextTriggerAt: null,
            notificationPermissionGranted: true,
            promotedNotificationPermissionGranted: true,
            promotedNotificationSettingsResolvable: true,
            sessionId: 'session-1',
          },
        });
        launchActionListener?.({
          intervalId: 'interval-1',
          launchSource: 'notification',
          notificationId: 5001,
          sessionId: 'session-1',
          triggeredAt: 100,
          type: 'check-in',
        });
      });

      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'interval-1',
        ),
      );

      mockMoveTaskToBack.mockClear();

      await act(async () => {
        fireEvent.press(screen.getByText('Award child'));
      });

      await waitFor(() => expect(mockMoveTaskToBack).toHaveBeenCalledTimes(1));
    } finally {
      jest.useRealTimers();
    }
  });

  it('queues parent unlock first when a notification launch arrives while locked', async () => {
    renderProvider({
      initialDocument: sharedFixture.document,
      initialParentUnlocked: false,
    });

    await waitFor(() =>
      expect(screen.getByTestId('notifications-ready').props.children).toBe(
        'ready',
      ),
    );

    await waitFor(() =>
      expect(useStartupNavigationStore.getState().requests).toEqual([
        expect.objectContaining({
          href: '/parent-unlock?mode=setup',
          id: 'notifications-parent-unlock',
          targetPathname: '/parent-unlock',
        }),
      ]),
    );
    expect(mockRequestNotificationPermission).not.toHaveBeenCalled();
  });

  it('opens the check-in modal from a foreground expiry without stopping the alarm playback', async () => {
    try {
      const runningFixture = createExpiredRunningSharedDocumentFixture();
      mockConsumePendingNotificationLaunchAction.mockResolvedValue(null);
      mockLoadPersistedNotificationDocument.mockResolvedValue(null);

      renderProvider({
        initialDocument: runningFixture.document,
        initialParentUnlocked: true,
      });

      await waitFor(() =>
        expect(screen.getByTestId('notifications-ready').props.children).toBe(
          'ready',
        ),
      );

      mockStopExpiredAlarmPlayback.mockClear();

      const notificationStateListener =
        mockAddNotificationStateChangeListener.mock.calls[0]?.[0];

      await act(async () => {
        notificationStateListener?.({
          document: createExpiredNotificationDocument(runningFixture.childId),
          reason: 'interval-triggered',
          runtimeStatus: {
            countdownNotificationChannelImportance: 2,
            countdownNotificationHasPromotableCharacteristics: true,
            countdownNotificationIsOngoing: false,
            countdownNotificationRequestedPromoted: true,
            countdownNotificationUsesChronometer: true,
            countdownNotificationWhen: null,
            exactAlarmPermissionGranted: true,
            expiredNotificationCategory: null,
            expiredNotificationChannelImportance: null,
            expiredNotificationHasCustomHeadsUp: false,
            expiredNotificationHasFullScreenIntent: false,
            fullScreenIntentPermissionGranted: true,
            fullScreenIntentSettingsResolvable: true,
            isAppInForeground: true,
            isRunning: false,
            lastTriggeredAt: 100,
            nextTriggerAt: null,
            notificationPermissionGranted: true,
            promotedNotificationPermissionGranted: true,
            promotedNotificationSettingsResolvable: true,
            sessionId: 'session-1',
          },
        });
      });

      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'interval-1',
        ),
      );
      expect(mockStopExpiredAlarmPlayback).not.toHaveBeenCalled();
      expect(useStartupNavigationStore.getState().requests).toEqual([
        expect.objectContaining({
          href: '/timer-check-in',
          id: 'notifications-check-in',
          targetPathname: '/timer-check-in',
        }),
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('defers check-in point commits until the session is fully resolved and records one transaction', async () => {
    try {
      const multiChildFixture = createExpiredRunningSharedDocumentFixture([
        'Avery',
        'Noah',
      ]);
      const [firstChildId, secondChildId] = multiChildFixture.childIds;

      if (!firstChildId || !secondChildId) {
        throw new Error(
          'Expected multi-child fixture to provide two child ids',
        );
      }

      mockLoadPersistedNotificationDocument.mockResolvedValue(
        createExpiredNotificationDocumentForChildren([
          { childId: firstChildId, childName: 'Avery', status: 'pending' },
          { childId: secondChildId, childName: 'Noah', status: 'pending' },
        ]),
      );

      renderProvider({
        initialDocument: multiChildFixture.document,
        initialParentUnlocked: true,
      });

      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'interval-1',
        ),
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Award child'));
      });

      await waitFor(() =>
        expect(screen.getByTestId('points-snapshot').props.children).toBe(
          '0|0',
        ),
      );
      expect(screen.getByTestId('point-adjustment-count').props.children).toBe(
        '0',
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Dismiss child'));
      });

      await waitFor(() =>
        expect(screen.getByTestId('points-snapshot').props.children).toBe(
          '0|0',
        ),
      );
      expect(screen.getByTestId('point-adjustment-count').props.children).toBe(
        '0',
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Award child 2'));
      });

      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'none',
        ),
      );
      await waitFor(() =>
        expect(screen.getByTestId('points-snapshot').props.children).toBe(
          '0|1',
        ),
      );
      expect(screen.getByTestId('point-adjustment-count').props.children).toBe(
        '1',
      );
      expect(screen.getByTestId('grouped-check-in-count').props.children).toBe(
        '2',
      );
      expect(screen.getByTestId('transaction-kinds').props.children).toContain(
        'points-adjusted',
      );
      expect(screen.getByTestId('transaction-kinds').props.children).toContain(
        'check-in-dismissed',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('awards a point, clears the expired session, and restarts the shared timer when the last action is resolved', async () => {
    try {
      const runningFixture = createExpiredRunningSharedDocumentFixture();
      mockLoadPersistedNotificationDocument.mockResolvedValue(
        createExpiredNotificationDocument(runningFixture.childId),
      );

      renderProvider({
        initialDocument: runningFixture.document,
        initialParentUnlocked: true,
      });

      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'interval-1',
        ),
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Award child'));
      });

      await waitFor(() =>
        expect(screen.getByTestId('points').props.children).toBe('1'),
      );
      await waitFor(() =>
        expect(screen.getByTestId('timer-mode').props.children).toBe('running'),
      );
      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'none',
        ),
      );
      expect(mockStopExpiredAlarmPlayback).toHaveBeenCalled();
      expect(mockStartNotificationTimer).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('resolves a final child action without restarting when restart is disabled', async () => {
    try {
      const runningFixture = createExpiredRunningSharedDocumentFixture();
      mockLoadPersistedNotificationDocument.mockResolvedValue(
        createExpiredNotificationDocument(runningFixture.childId),
      );

      renderProvider({
        initialDocument: runningFixture.document,
        initialParentUnlocked: true,
      });

      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'interval-1',
        ),
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Award child without restart'));
      });

      await waitFor(() =>
        expect(screen.getByTestId('points').props.children).toBe('1'),
      );
      await waitFor(() =>
        expect(screen.getByTestId('timer-mode').props.children).toBe('idle'),
      );
      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'none',
        ),
      );
      expect(mockStartNotificationTimer).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('clears dismissed expired notification state before a manual timer restart', async () => {
    try {
      const runningFixture = createExpiredRunningSharedDocumentFixture();
      mockLoadPersistedNotificationDocument.mockResolvedValue(
        createExpiredNotificationDocument(runningFixture.childId),
      );

      renderProvider({
        initialDocument: runningFixture.document,
        initialParentUnlocked: true,
      });

      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'interval-1',
        ),
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Dismiss flow'));
      });

      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'none',
        ),
      );
      await waitFor(() =>
        expect(screen.getByTestId('timer-mode').props.children).toBe('idle'),
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Start timer'));
      });

      await waitFor(() =>
        expect(screen.getByTestId('timer-mode').props.children).toBe('running'),
      );

      expect(mockStartNotificationTimer).toHaveBeenCalledWith(
        expect.objectContaining({
          head: expect.objectContaining({
            expiredIntervals: [],
            timerRuntimeState: expect.objectContaining({
              lastTriggeredAt: null,
              nextTriggerAt: null,
              sessionId: null,
            }),
            timerState: expect.objectContaining({
              activeIntervalMs: 900000,
            }),
          }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('restarts native scheduling when startup hydrates an expired session over a stale running shared timer', async () => {
    try {
      const runningFixture = createExpiredRunningSharedDocumentFixture();
      mockLoadPersistedNotificationDocument.mockResolvedValue(
        createExpiredNotificationDocument(runningFixture.childId),
      );

      renderProvider({
        initialDocument: runningFixture.document,
        initialParentUnlocked: true,
      });

      await waitFor(() =>
        expect(screen.getByTestId('active-session').props.children).toBe(
          'interval-1',
        ),
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Award child'));
      });

      await waitFor(() =>
        expect(mockStartNotificationTimer).toHaveBeenCalledTimes(1),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('reissues native pause and start scheduling across repeated pause and resume transitions', async () => {
    try {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
      mockConsumePendingNotificationLaunchAction.mockResolvedValue(null);
      mockLoadPersistedNotificationDocument.mockResolvedValue(null);

      renderProvider({
        initialDocument: sharedFixture.document,
        initialParentUnlocked: true,
      });

      await waitFor(() =>
        expect(screen.getByTestId('notifications-ready').props.children).toBe(
          'ready',
        ),
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Start timer'));
      });

      await waitFor(() =>
        expect(mockStartNotificationTimer).toHaveBeenCalledTimes(1),
      );

      jest.advanceTimersByTime(2_000);
      jest.setSystemTime(new Date('2026-04-08T12:00:02.000Z'));

      await act(async () => {
        fireEvent.press(screen.getByText('Pause timer'));
      });

      await waitFor(() =>
        expect(mockPauseNotificationTimer).toHaveBeenCalledTimes(1),
      );

      jest.advanceTimersByTime(3_000);
      jest.setSystemTime(new Date('2026-04-08T12:00:05.000Z'));

      await act(async () => {
        fireEvent.press(screen.getByText('Start timer'));
      });

      await waitFor(() =>
        expect(mockStartNotificationTimer).toHaveBeenCalledTimes(2),
      );

      const resumedDocument = mockStartNotificationTimer.mock
        .calls[1]?.[0] as NotificationDocument;

      expect(resumedDocument.head.timerState.isRunning).toBe(true);
      expect(resumedDocument.head.timerState.cycleStartedAt).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('requests notification permission at startup when enabled and currently denied', async () => {
    mockGetNotificationRuntimeStatus
      .mockResolvedValueOnce({
        countdownNotificationChannelImportance: 2,
        countdownNotificationHasPromotableCharacteristics: true,
        countdownNotificationIsOngoing: false,
        countdownNotificationRequestedPromoted: true,
        countdownNotificationUsesChronometer: true,
        countdownNotificationWhen: null,
        exactAlarmPermissionGranted: true,
        expiredNotificationCategory: 'alarm',
        expiredNotificationChannelImportance: 4,
        expiredNotificationHasCustomHeadsUp: true,
        expiredNotificationHasFullScreenIntent: true,
        fullScreenIntentPermissionGranted: true,
        fullScreenIntentSettingsResolvable: true,
        isAppInForeground: true,
        isRunning: false,
        lastTriggeredAt: 100,
        nextTriggerAt: null,
        notificationPermissionGranted: false,
        promotedNotificationPermissionGranted: true,
        promotedNotificationSettingsResolvable: true,
        sessionId: 'session-1',
      })
      .mockResolvedValue({
        countdownNotificationChannelImportance: 2,
        countdownNotificationHasPromotableCharacteristics: true,
        countdownNotificationIsOngoing: false,
        countdownNotificationRequestedPromoted: true,
        countdownNotificationUsesChronometer: true,
        countdownNotificationWhen: null,
        exactAlarmPermissionGranted: true,
        expiredNotificationCategory: 'alarm',
        expiredNotificationChannelImportance: 4,
        expiredNotificationHasCustomHeadsUp: true,
        expiredNotificationHasFullScreenIntent: true,
        fullScreenIntentPermissionGranted: true,
        fullScreenIntentSettingsResolvable: true,
        isAppInForeground: true,
        isRunning: false,
        lastTriggeredAt: 100,
        nextTriggerAt: null,
        notificationPermissionGranted: true,
        promotedNotificationPermissionGranted: true,
        promotedNotificationSettingsResolvable: true,
        sessionId: 'session-1',
      });

    renderProvider({
      initialDocument: sharedFixture.document,
      initialParentUnlocked: true,
    });

    await waitFor(() =>
      expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1),
    );
  });

  it('keeps expiry scheduling active when live countdown notifications are disabled', async () => {
    renderProvider({
      initialDocument: sharedFixture.document,
      initialLiveCountdownNotificationsEnabled: false,
      initialParentUnlocked: true,
    });

    await waitFor(() =>
      expect(screen.getByTestId('notifications-ready').props.children).toBe(
        'ready',
      ),
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Start timer'));
    });

    await waitFor(() =>
      expect(mockStartNotificationTimer).toHaveBeenCalledTimes(1),
    );
    expect(mockStartNotificationTimer).toHaveBeenCalledWith(
      expect.objectContaining({
        head: expect.objectContaining({
          timerConfig: expect.objectContaining({
            liveCountdownNotificationsEnabled: false,
          }),
        }),
      }),
    );
  });
});
