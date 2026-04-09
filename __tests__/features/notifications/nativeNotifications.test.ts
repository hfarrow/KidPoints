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
    expect(await nativeNotifications.moveTaskToBack()).toBe(false);
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
      nativeNotifications.addNotificationLogListener(jest.fn()),
    ).toBeNull();
    expect(
      nativeNotifications.addNotificationLaunchActionListener(jest.fn()),
    ).toBeNull();
    expect(nativeNotifications.getBufferedNotificationLogs()).toEqual([]);
  });

  it('parses native state, native-log, and launch-action events', async () => {
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
              activeIntervalMs: 900000,
              cycleStartedAt: 100,
              isRunning: true,
              pausedRemainingMs: null,
            },
          },
          schemaVersion: 1,
        }),
      ),
      getBufferedLogs: jest.fn(() =>
        JSON.stringify([
          {
            contextJson: JSON.stringify({ source: 'buffer' }),
            level: 'debug',
            message: 'Buffered native log',
            sequence: 1,
            tag: 'KidPointsNotifications',
            timestampMs: 123,
          },
        ]),
      ),
      getPendingLaunchAction: jest.fn(async () =>
        JSON.stringify({
          intervalId: 'interval-1',
          launchSource: 'full-screen-intent',
          notificationId: 5001,
          sessionId: 'session-1',
          triggeredAt: 123,
          type: 'check-in',
        }),
      ),
      getRuntimeStatus: jest.fn(async () => '{'),
      openExactAlarmSettings: jest.fn(async () => undefined),
      openFullScreenIntentSettings: jest.fn(async () => undefined),
      moveTaskToBack: jest.fn(async () => true),
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
    const onLogEntry = jest.fn();
    const onLaunchAction = jest.fn();

    const stateSubscription =
      nativeNotifications.addNotificationStateChangeListener(onStateChanged);
    const logSubscription =
      nativeNotifications.addNotificationLogListener(onLogEntry);
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
            activeIntervalMs: 900000,
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
      contextJson: JSON.stringify({ source: 'event' }),
      level: 'warn',
      message: 'Native event log',
      sequence: 2,
      tag: 'KidPointsNotificationsIntent',
      timestampMs: 456,
    });
    subscriptions[2]?.({
      actionJson: JSON.stringify({
        intervalId: 'interval-1',
        launchSource: 'full-screen-intent',
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
      launchSource: 'full-screen-intent',
      notificationId: 5001,
      sessionId: 'session-1',
      triggeredAt: 123,
      type: 'check-in',
    });
    expect(await nativeNotifications.moveTaskToBack()).toBe(true);
    expect(
      await nativeNotifications.getNotificationRuntimeStatus(),
    ).toMatchObject({
      exactAlarmPermissionGranted: false,
      isRunning: false,
      nextTriggerAt: null,
    });
    expect(nativeNotifications.getBufferedNotificationLogs()).toEqual([
      {
        contextJson: JSON.stringify({ source: 'buffer' }),
        level: 'debug',
        message: 'Buffered native log',
        sequence: 1,
        tag: 'KidPointsNotifications',
        timestampMs: 123,
      },
    ]);
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
    expect(onLogEntry).toHaveBeenCalledWith({
      contextJson: JSON.stringify({ source: 'event' }),
      level: 'warn',
      message: 'Native event log',
      sequence: 2,
      tag: 'KidPointsNotificationsIntent',
      timestampMs: 456,
    });
    expect(onLaunchAction).toHaveBeenCalledWith({
      intervalId: 'interval-1',
      launchSource: 'full-screen-intent',
      notificationId: 5001,
      sessionId: 'session-1',
      triggeredAt: 123,
      type: 'check-in',
    });

    stateSubscription?.remove();
    logSubscription?.remove();
    launchSubscription?.remove();
    expect(remove).toHaveBeenCalledTimes(3);
  });

  it('normalizes legacy string null session ids from native payloads', async () => {
    const subscriptions: ((event: unknown) => void)[] = [];
    const nativeModule = {
      addListener: jest.fn(
        (_eventName: string, listener: (event: unknown) => void) => {
          subscriptions.push(listener);
          return { remove: jest.fn() };
        },
      ),
      canScheduleExactAlarms: jest.fn(async () => true),
      consumePendingLaunchAction: jest.fn(async () =>
        JSON.stringify({
          intervalId: 'interval-1',
          notificationId: 5001,
          sessionId: 'null',
          triggeredAt: 123,
          type: 'check-in',
        }),
      ),
      getBufferedLogs: jest.fn(() => '[]'),
      getDocument: jest.fn(async () =>
        JSON.stringify({
          head: {
            children: [],
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
              sessionId: 'null',
            },
            timerState: {
              activeIntervalMs: 900000,
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
          sessionId: 'null',
          triggeredAt: 123,
          type: 'check-in',
        }),
      ),
      getRuntimeStatus: jest.fn(async () =>
        JSON.stringify({
          exactAlarmPermissionGranted: true,
          isRunning: true,
          nextTriggerAt: 123,
          notificationPermissionGranted: true,
          sessionId: 'null',
        }),
      ),
      openExactAlarmSettings: jest.fn(async () => undefined),
      openFullScreenIntentSettings: jest.fn(async () => undefined),
      openNotificationSettings: jest.fn(async () => undefined),
      openPromotedNotificationSettings: jest.fn(async () => undefined),
      pauseTimer: jest.fn(async (documentJson: string) => documentJson),
      resetTimer: jest.fn(async (documentJson: string) => documentJson),
      requestNotificationPermission: jest.fn(async () => true),
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

    const stateListener = jest.fn();
    nativeNotifications.addNotificationStateChangeListener(stateListener);

    subscriptions[0]?.({
      documentJson: JSON.stringify({
        head: {
          children: [],
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
            sessionId: 'null',
          },
          timerState: {
            activeIntervalMs: 900000,
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
        sessionId: 'null',
      }),
    });

    await expect(
      nativeNotifications.loadPersistedNotificationDocument(),
    ).resolves.toMatchObject({
      head: {
        timerRuntimeState: {
          nextTriggerAt: 123,
          sessionId: null,
        },
      },
    });
    await expect(
      nativeNotifications.getPendingNotificationLaunchAction(),
    ).resolves.toEqual({
      intervalId: 'interval-1',
      notificationId: 5001,
      sessionId: null,
      triggeredAt: 123,
      type: 'check-in',
    });
    await expect(
      nativeNotifications.getNotificationRuntimeStatus(),
    ).resolves.toMatchObject({
      exactAlarmPermissionGranted: true,
      isRunning: true,
      nextTriggerAt: 123,
      sessionId: null,
    });
    expect(stateListener).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeStatus: expect.objectContaining({
          sessionId: null,
        }),
      }),
    );
  });
});
