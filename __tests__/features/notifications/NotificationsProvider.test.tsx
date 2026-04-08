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
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import {
  clearStartupNavigationRequests,
  useStartupNavigationStore,
} from '../../../src/navigation/startupNavigationStore';
import {
  createInitialSharedDocument,
  createSharedStore,
  SharedStoreProvider,
  useSharedStore,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

jest.mock('../../../src/features/notifications/nativeNotifications', () => ({
  addNotificationLaunchActionListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  addNotificationStateChangeListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  consumePendingNotificationLaunchAction: jest.fn(),
  getNotificationRuntimeStatus: jest.fn(),
  isNotificationsModuleAvailable: jest.fn(() => true),
  loadPersistedNotificationDocument: jest.fn(),
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
  addNotificationLaunchActionListener: mockAddNotificationLaunchActionListener,
  addNotificationStateChangeListener: mockAddNotificationStateChangeListener,
  consumePendingNotificationLaunchAction:
    mockConsumePendingNotificationLaunchAction,
  getNotificationRuntimeStatus: mockGetNotificationRuntimeStatus,
  loadPersistedNotificationDocument: mockLoadPersistedNotificationDocument,
  requestNotificationPermission: mockRequestNotificationPermission,
  startNotificationTimer: mockStartNotificationTimer,
  stopExpiredAlarmPlayback: mockStopExpiredAlarmPlayback,
} = jest.requireMock(
  '../../../src/features/notifications/nativeNotifications',
) as {
  addNotificationLaunchActionListener: jest.Mock;
  addNotificationStateChangeListener: jest.Mock;
  consumePendingNotificationLaunchAction: jest.Mock<
    Promise<PendingNotificationLaunchAction | null>,
    []
  >;
  getNotificationRuntimeStatus: jest.Mock;
  loadPersistedNotificationDocument: jest.Mock<
    Promise<NotificationDocument | null>,
    []
  >;
  requestNotificationPermission: jest.Mock;
  startNotificationTimer: jest.Mock;
  stopExpiredAlarmPlayback: jest.Mock;
};

function createSharedDocumentFixture() {
  const store = createSharedStore({
    initialDocument: createInitialSharedDocument({
      deviceId: 'notifications-provider',
    }),
    storage: createMemoryStorage(),
  });

  store.getState().addChild('Avery');

  const document = store.getState().document;
  const childId = document.head.activeChildIds[0] ?? null;

  if (!childId) {
    throw new Error('Expected shared store fixture to create an active child');
  }

  return { childId, document };
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
        notificationsEnabled: true,
      },
      timerRuntimeState: {
        lastTriggeredAt: 100,
        nextTriggerAt: null,
        sessionId: 'session-1',
      },
      timerState: {
        cycleStartedAt: null,
        isRunning: false,
        pausedRemainingMs: null,
      },
    },
    schemaVersion: 1,
  };
}

function NotificationsProbe() {
  const { activeExpiredTimerSession, isReady, resolveExpiredTimerChild } =
    useNotifications();
  const sharedDocument = useSharedStore((state) => state.document);
  const activeChildId = sharedDocument.head.activeChildIds[0] ?? null;

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
    </>
  );
}

function renderProvider({
  initialDocument,
  initialParentUnlocked = true,
}: {
  initialDocument: ReturnType<typeof createSharedDocumentFixture>['document'];
  initialParentUnlocked?: boolean;
}) {
  return render(
    <SharedStoreProvider
      initialDocument={initialDocument}
      storage={createMemoryStorage()}
    >
      <ParentSessionProvider initialParentUnlocked={initialParentUnlocked}>
        <AppThemeProvider
          initialThemeMode="light"
          storage={createMemoryStorage()}
        >
          <NotificationsProvider>
            <NotificationsProbe />
          </NotificationsProvider>
        </AppThemeProvider>
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
    mockRequestNotificationPermission.mockResolvedValue(true);
    mockLoadPersistedNotificationDocument.mockResolvedValue(
      createExpiredNotificationDocument(sharedFixture.childId),
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

  it('awards a point, clears the expired session, and restarts the shared timer when the last action is resolved', async () => {
    renderProvider({
      initialDocument: sharedFixture.document,
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
      expect(screen.getByTestId('active-session').props.children).toBe('none'),
    );
    expect(mockStopExpiredAlarmPlayback).toHaveBeenCalled();
    expect(mockStartNotificationTimer).toHaveBeenCalled();
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

  it('does not request notification permission at startup when notifications are disabled in local settings', async () => {
    render(
      <SharedStoreProvider
        initialDocument={sharedFixture.document}
        storage={createMemoryStorage()}
      >
        <ParentSessionProvider initialParentUnlocked>
          <AppThemeProvider
            initialNotificationsEnabled={false}
            initialThemeMode="light"
            storage={createMemoryStorage()}
          >
            <NotificationsProvider>
              <NotificationsProbe />
            </NotificationsProvider>
          </AppThemeProvider>
        </ParentSessionProvider>
      </SharedStoreProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('notifications-ready').props.children).toBe(
        'ready',
      ),
    );
    expect(mockRequestNotificationPermission).not.toHaveBeenCalled();
  });
});
