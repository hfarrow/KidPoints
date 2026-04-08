describe('nativeNotifications', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('falls back safely when the native module is unavailable', async () => {
    jest.doMock('expo-modules-core', () => ({
      requireOptionalNativeModule: jest.fn(() => null),
    }));

    let nativeNotifications!: typeof import('../../../src/features/notifications/nativeNotifications');
    jest.isolateModules(() => {
      nativeNotifications = jest.requireActual(
        '../../../src/features/notifications/nativeNotifications',
      );
    });

    expect(nativeNotifications.isNotificationsModuleAvailable()).toBe(false);
    expect(
      await nativeNotifications.loadPersistedNotificationDocument(),
    ).toBeNull();
    expect(
      await nativeNotifications.getPendingNotificationLaunchAction(),
    ).toBeNull();
    expect(
      await nativeNotifications.consumePendingNotificationLaunchAction(),
    ).toBeNull();
    expect(await nativeNotifications.getNotificationRuntimeStatus()).toEqual({
      countdownNotificationChannelImportance: null,
      countdownNotificationHasPromotableCharacteristics: false,
      countdownNotificationIsOngoing: false,
      countdownNotificationRequestedPromoted: false,
      countdownNotificationUsesChronometer: false,
      countdownNotificationWhen: null,
      exactAlarmPermissionGranted: false,
      expiredNotificationCategory: null,
      expiredNotificationChannelImportance: null,
      expiredNotificationHasCustomHeadsUp: false,
      expiredNotificationHasFullScreenIntent: false,
      fullScreenIntentPermissionGranted: false,
      fullScreenIntentSettingsResolvable: false,
      isAppInForeground: false,
      isRunning: false,
      lastTriggeredAt: null,
      nextTriggerAt: null,
      notificationPermissionGranted: false,
      promotedNotificationPermissionGranted: false,
      promotedNotificationSettingsResolvable: false,
      sessionId: null,
    });
    expect(
      nativeNotifications.addNotificationStateChangeListener(jest.fn()),
    ).toBeNull();
    expect(
      nativeNotifications.addNotificationLaunchActionListener(jest.fn()),
    ).toBeNull();
  });

  it('parses native state and launch-action events', async () => {
    const subscriptions: ((event: unknown) => void)[] = [];
    const remove = jest.fn();
    const nativeModule = {
      addListener: jest.fn(
        (_eventName: string, listener: (event: unknown) => void) => {
          subscriptions.push(listener);
          return { remove };
        },
      ),
      canScheduleExactAlarms: jest.fn(async () => true),
      consumePendingLaunchAction: jest.fn(async () => null),
      getDocument: jest.fn(async () =>
        JSON.stringify({
          head: {
            children: [
              { displayName: 'Avery', id: 'child-1', isArchived: false },
            ],
            expiredIntervals: [],
            timerConfig: {
              alarmDurationSeconds: 20,
              intervalMinutes: 15,
              intervalSeconds: 0,
              notificationsEnabled: true,
            },
            timerRuntimeState: {
              lastTriggeredAt: null,
              nextTriggerAt: 123,
              sessionId: 'session-1',
            },
            timerState: {
              cycleStartedAt: 100,
              isRunning: true,
              pausedRemainingMs: null,
            },
          },
          schemaVersion: 1,
        }),
      ),
      getPendingLaunchAction: jest.fn(async () =>
        JSON.stringify({
          intervalId: 'interval-1',
          notificationId: 5001,
          sessionId: 'session-1',
          triggeredAt: 123,
          type: 'check-in',
        }),
      ),
      getRuntimeStatus: jest.fn(async () => '{'),
      openExactAlarmSettings: jest.fn(async () => undefined),
      openFullScreenIntentSettings: jest.fn(async () => undefined),
      openNotificationSettings: jest.fn(async () => undefined),
      openPromotedNotificationSettings: jest.fn(async () => undefined),
      pauseTimer: jest.fn(async (documentJson: string) => documentJson),
      resetTimer: jest.fn(async (documentJson: string) => documentJson),
      saveDocument: jest.fn(async (documentJson: string) => documentJson),
      startTimer: jest.fn(async (documentJson: string) => documentJson),
      stopExpiredAlarmPlayback: jest.fn(async () => undefined),
      syncDocument: jest.fn(async (documentJson: string) => documentJson),
    };

    jest.doMock('expo-modules-core', () => ({
      requireOptionalNativeModule: jest.fn(() => nativeModule),
    }));

    let nativeNotifications!: typeof import('../../../src/features/notifications/nativeNotifications');
    jest.isolateModules(() => {
      nativeNotifications = jest.requireActual(
        '../../../src/features/notifications/nativeNotifications',
      );
    });
    const onStateChanged = jest.fn();
    const onLaunchAction = jest.fn();

    const stateSubscription =
      nativeNotifications.addNotificationStateChangeListener(onStateChanged);
    const launchSubscription =
      nativeNotifications.addNotificationLaunchActionListener(onLaunchAction);

    subscriptions[0]?.({
      documentJson: JSON.stringify({
        head: {
          children: [
            { displayName: 'Avery', id: 'child-1', isArchived: false },
          ],
          expiredIntervals: [],
          timerConfig: {
            alarmDurationSeconds: 20,
            intervalMinutes: 15,
            intervalSeconds: 0,
            notificationsEnabled: true,
          },
          timerRuntimeState: {
            lastTriggeredAt: null,
            nextTriggerAt: 123,
            sessionId: 'session-1',
          },
          timerState: {
            cycleStartedAt: 100,
            isRunning: true,
            pausedRemainingMs: null,
          },
        },
        schemaVersion: 1,
      }),
      reason: 'timer-started',
      runtimeStatusJson: JSON.stringify({
        exactAlarmPermissionGranted: true,
        isRunning: true,
        nextTriggerAt: 123,
        notificationPermissionGranted: true,
        sessionId: 'session-1',
      }),
    });
    subscriptions[1]?.({
      actionJson: JSON.stringify({
        intervalId: 'interval-1',
        notificationId: 5001,
        sessionId: 'session-1',
        triggeredAt: 123,
        type: 'check-in',
      }),
    });

    expect(
      await nativeNotifications.loadPersistedNotificationDocument(),
    ).toMatchObject({
      head: {
        children: [{ displayName: 'Avery', id: 'child-1', isArchived: false }],
        timerRuntimeState: {
          nextTriggerAt: 123,
          sessionId: 'session-1',
        },
      },
    });
    expect(
      await nativeNotifications.getPendingNotificationLaunchAction(),
    ).toEqual({
      intervalId: 'interval-1',
      notificationId: 5001,
      sessionId: 'session-1',
      triggeredAt: 123,
      type: 'check-in',
    });
    expect(
      await nativeNotifications.getNotificationRuntimeStatus(),
    ).toMatchObject({
      exactAlarmPermissionGranted: false,
      isRunning: false,
      nextTriggerAt: null,
    });
    expect(onStateChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({
          head: expect.objectContaining({
            timerState: expect.objectContaining({ isRunning: true }),
          }),
        }),
        reason: 'timer-started',
        runtimeStatus: expect.objectContaining({
          exactAlarmPermissionGranted: true,
          isRunning: true,
          nextTriggerAt: 123,
        }),
      }),
    );
    expect(onLaunchAction).toHaveBeenCalledWith({
      intervalId: 'interval-1',
      notificationId: 5001,
      sessionId: 'session-1',
      triggeredAt: 123,
      type: 'check-in',
    });

    stateSubscription?.remove();
    launchSubscription?.remove();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
