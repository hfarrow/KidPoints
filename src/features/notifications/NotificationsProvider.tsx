import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, type AppStateStatus, Platform } from 'react-native';
import { type AppLogDetails, createModuleLogger } from '../../logging/logger';
import { connectNativeLogReceiver } from '../../logging/nativeLogSync';
import { useStartupNavigationStore } from '../../navigation/startupNavigationStore';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import { useSharedStore, useSharedStoreApi } from '../../state/sharedStore';
import { useParentSession } from '../parent/parentSessionContext';
import {
  addNotificationLaunchActionListener,
  addNotificationLogListener,
  addNotificationStateChangeListener,
  consumePendingNotificationLaunchAction,
  getBufferedNotificationLogs,
  getNotificationRuntimeStatus,
  isNotificationsModuleAvailable,
  loadPersistedNotificationDocument,
  moveTaskToBack,
  type NotificationNativeLogEntry,
  openExactAlarmSettings,
  openFullScreenIntentSettings,
  openNotificationSettings,
  openPromotedNotificationSettings,
  pauseNotificationTimer,
  requestNotificationPermission,
  resetNotificationTimer,
  startNotificationTimer,
  stopExpiredAlarmPlayback,
  syncNotificationDocument,
} from './nativeNotifications';
import {
  areNotificationDocumentsEqual,
  createDefaultNotificationRuntimeStatus,
  createEmptyNotificationDocument,
  createPendingLaunchActionFromExpiredTimerSession,
  deriveNotificationDocument,
  type ExpiredTimerSession,
  getExpiredTimerSession,
  getRestorablePendingLaunchAction,
  type NotificationDocument,
  type NotificationRuntimeStatus,
  type PendingNotificationLaunchAction,
  parseNotificationDocument,
  resolveExpiredTimerChildAction,
} from './notificationsModel';

const CHECK_IN_ROUTE = '/timer-check-in';
const LOCK_SCREEN_CHECK_IN_ROUTE = '/timer-check-in-lock-screen';
const CHECK_IN_REQUEST_ID = 'notifications-check-in';
const PARENT_UNLOCK_REQUEST_ID = 'notifications-parent-unlock';
const log = createModuleLogger('notifications-provider');

type SharedStoreWithPersist = ReturnType<typeof useSharedStoreApi> & {
  persist?: {
    hasHydrated?: () => boolean;
    onFinishHydration?: (listener: () => void) => () => void;
    onHydrate?: (listener: () => void) => () => void;
  };
};

type NotificationsContextValue = {
  activeExpiredTimerSession: ExpiredTimerSession | null;
  dismissCheckInFlow: () => void;
  engineAvailable: boolean;
  isReady: boolean;
  liveCountdownNotificationsEnabled: boolean;
  openExactAlarmSettings: () => Promise<void>;
  openFullScreenIntentSettings: () => Promise<void>;
  openNotificationSettings: () => Promise<void>;
  openPromotedNotificationSettings: () => Promise<void>;
  refreshRuntimeStatus: () => Promise<NotificationRuntimeStatus>;
  requestTimerStart: (source: string) => Promise<void>;
  resolveExpiredTimerChild: (
    childId: string,
    status: 'awarded' | 'dismissed',
    options?: {
      restartTimerOnResolve?: boolean;
    },
  ) => Promise<void>;
  runtimeStatus: NotificationRuntimeStatus;
  setLiveCountdownNotificationsEnabled: (
    liveCountdownNotificationsEnabled: boolean,
  ) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

function buildParentUnlockHref(parentPin: string | null) {
  return parentPin ? '/parent-unlock' : '/parent-unlock?mode=setup';
}

function createLaunchActionKey(
  launchAction: PendingNotificationLaunchAction | null | undefined,
) {
  if (!launchAction) {
    return null;
  }

  return JSON.stringify({
    intervalId: launchAction.intervalId,
    notificationId: launchAction.notificationId,
    sessionId: launchAction.sessionId,
    triggeredAt: launchAction.triggeredAt,
    type: launchAction.type,
  });
}

function getCheckInRouteForLaunchAction(
  launchAction: PendingNotificationLaunchAction | null | undefined,
) {
  return isTemporaryCheckInLaunchAction(launchAction)
    ? LOCK_SCREEN_CHECK_IN_ROUTE
    : CHECK_IN_ROUTE;
}

function isTemporaryCheckInLaunchAction(
  launchAction: PendingNotificationLaunchAction | null | undefined,
) {
  return (
    launchAction?.launchSource === 'notification' ||
    launchAction?.launchSource === 'full-screen-intent'
  );
}

function confirmOpenExactAlarmSettings(): Promise<boolean> {
  return new Promise((resolve) => {
    let didResolve = false;
    const complete = (value: boolean) => {
      if (didResolve) {
        return;
      }

      didResolve = true;
      resolve(value);
    };

    Alert.alert(
      'Allow Exact Alarms',
      'KidPoints needs exact alarms for reliable timer check-ins. We will open Android settings so you can allow exact alarms for this app.',
      [
        {
          style: 'cancel',
          text: 'Not Now',
          onPress: () => {
            complete(false);
          },
        },
        {
          text: 'Open Settings',
          onPress: () => {
            complete(true);
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          complete(false);
        },
      },
    );
  });
}

export function NotificationsProvider({ children }: PropsWithChildren) {
  const engineAvailable = isNotificationsModuleAvailable();
  const sharedStoreApi = useSharedStoreApi() as SharedStoreWithPersist;
  const document = useSharedStore((state) => state.document);
  const pauseSharedTimer = useSharedStore((state) => state.pauseTimer);
  const resetSharedTimer = useSharedStore((state) => state.resetTimer);
  const resolveCheckInSession = useSharedStore(
    (state) => state.resolveCheckInSession,
  );
  const startSharedTimer = useSharedStore((state) => state.startTimer);
  const liveCountdownNotificationsEnabled = useLocalSettingsStore(
    (state) => state.liveCountdownNotificationsEnabled,
  );
  const parentPin = useLocalSettingsStore((state) => state.parentPin);
  const setLiveCountdownNotificationsEnabled = useLocalSettingsStore(
    (state) => state.setLiveCountdownNotificationsEnabled,
  );
  const hasLocalSettingsHydrated = useLocalSettingsStore(
    (state) => state.hasHydrated,
  );
  const { isParentUnlocked } = useParentSession();
  const queueStartupNavigationRequest = useStartupNavigationStore(
    (state) => state.queueRequest,
  );
  const removeStartupNavigationRequest = useStartupNavigationStore(
    (state) => state.removeRequest,
  );
  const [notificationDocument, setNotificationDocument] =
    useState<NotificationDocument>(createEmptyNotificationDocument);
  const [pendingLaunchAction, setPendingLaunchAction] =
    useState<PendingNotificationLaunchAction | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<NotificationRuntimeStatus>(
    createDefaultNotificationRuntimeStatus,
  );
  const [hasSharedStoreHydrated, setHasSharedStoreHydrated] = useState(
    () => sharedStoreApi.persist?.hasHydrated?.() ?? true,
  );
  const [hasInitialized, setHasInitialized] = useState(false);
  const didConsumeStartupLaunchActionRef = useRef(false);
  const notificationDocumentRef = useRef(notificationDocument);
  const pendingLaunchActionRef = useRef(pendingLaunchAction);
  const activeLaunchActionKeyRef = useRef<string | null>(null);
  const sharedDocumentRef = useRef(document);
  const skipNextResumeConsumeRef = useRef(false);
  const lastSyncedDocumentRef = useRef<NotificationDocument | null>(null);
  const lastSeenNativeLogSequenceRef = useRef(-1);
  const liveCountdownNotificationsEnabledRef = useRef(
    liveCountdownNotificationsEnabled,
  );
  const isReady = hasLocalSettingsHydrated && hasSharedStoreHydrated;

  useEffect(() => {
    notificationDocumentRef.current = notificationDocument;
  }, [notificationDocument]);

  useEffect(() => {
    pendingLaunchActionRef.current = pendingLaunchAction;
    activeLaunchActionKeyRef.current =
      createLaunchActionKey(pendingLaunchAction);
  }, [pendingLaunchAction]);

  useEffect(() => {
    sharedDocumentRef.current = document;
  }, [document]);

  useEffect(() => {
    liveCountdownNotificationsEnabledRef.current =
      liveCountdownNotificationsEnabled;
  }, [liveCountdownNotificationsEnabled]);

  useEffect(() => {
    if (!engineAvailable) {
      return;
    }

    return connectNativeLogReceiver<NotificationNativeLogEntry>({
      addLogListener: addNotificationLogListener,
      getBufferedEntries: getBufferedNotificationLogs,
      getLastSeenSequence: () => lastSeenNativeLogSequenceRef.current,
      parseContextJson: (contextJson) =>
        parseNotificationNativeLogContext(contextJson),
      setLastSeenSequence: (sequence) => {
        lastSeenNativeLogSequenceRef.current = sequence;
      },
    });
  }, [engineAvailable]);

  useEffect(() => {
    const persistApi = sharedStoreApi.persist;

    if (!persistApi) {
      setHasSharedStoreHydrated(true);
      return;
    }

    setHasSharedStoreHydrated(persistApi.hasHydrated?.() ?? true);

    const removeHydrateListener = persistApi.onHydrate?.(() => {
      setHasSharedStoreHydrated(false);
    });
    const removeFinishHydrationListener = persistApi.onFinishHydration?.(() => {
      setHasSharedStoreHydrated(true);
    });

    return () => {
      removeHydrateListener?.();
      removeFinishHydrationListener?.();
    };
  }, [sharedStoreApi]);

  const refreshRuntimeStatus = useCallback(async () => {
    const nextRuntimeStatus = await getNotificationRuntimeStatus();
    setRuntimeStatus(nextRuntimeStatus);
    return nextRuntimeStatus;
  }, []);

  const completeTemporaryLaunchIfNeeded = useCallback(
    (launchAction: PendingNotificationLaunchAction | null | undefined) => {
      if (!isTemporaryCheckInLaunchAction(launchAction)) {
        return;
      }

      void moveTaskToBack();
    },
    [],
  );

  const applyNativeDocumentJson = useCallback(
    (
      documentJson: string,
      fallbackDocument: NotificationDocument,
    ): NotificationDocument => {
      const nextDocument =
        parseNotificationDocument(documentJson) ?? fallbackDocument;

      setNotificationDocument(nextDocument);
      notificationDocumentRef.current = nextDocument;
      lastSyncedDocumentRef.current = nextDocument;

      return nextDocument;
    },
    [],
  );

  const requestTimerStart = useCallback(
    async (source: string) => {
      let nextRuntimeStatus = await refreshRuntimeStatus();

      if (!nextRuntimeStatus.notificationPermissionGranted) {
        log.info('Requesting notification permission from timer start', {
          source,
        });
        await requestNotificationPermission();
        nextRuntimeStatus = await refreshRuntimeStatus();
      }

      if (
        Platform.OS === 'android' &&
        engineAvailable &&
        !nextRuntimeStatus.exactAlarmPermissionGranted
      ) {
        log.info('Blocking timer start until exact alarms are enabled', {
          source,
        });
        const shouldOpenSettings = await confirmOpenExactAlarmSettings();

        if (!shouldOpenSettings) {
          log.info('User declined exact alarm settings handoff', {
            source,
          });
          return;
        }

        log.info('Opening exact alarm settings from timer start flow', {
          source,
        });
        await openExactAlarmSettings();
        return;
      }

      log.info('Starting timer after notification permission checks', {
        exactAlarmPermissionGranted:
          nextRuntimeStatus.exactAlarmPermissionGranted,
        notificationPermissionGranted:
          nextRuntimeStatus.notificationPermissionGranted,
        source,
      });
      startSharedTimer();
    },
    [engineAvailable, refreshRuntimeStatus, startSharedTimer],
  );

  const syncResolvedDocument = useCallback(
    async (nextDocument: NotificationDocument) => {
      if (!engineAvailable) {
        return;
      }

      const syncedDocument = await syncNotificationDocument(nextDocument);
      applyNativeDocumentJson(syncedDocument, nextDocument);
      await refreshRuntimeStatus();
    },
    [applyNativeDocumentJson, engineAvailable, refreshRuntimeStatus],
  );

  const restoreMissedLaunchAction = useCallback(
    (
      source: 'resume' | 'startup',
      launchAction: PendingNotificationLaunchAction | null,
    ) => {
      const restoredLaunchAction = getRestorablePendingLaunchAction(
        notificationDocumentRef.current,
        launchAction,
      );

      if (launchAction || !restoredLaunchAction) {
        return restoredLaunchAction;
      }

      log.info(
        'Restoring missed check-in launch action from persisted session',
        {
          intervalId: restoredLaunchAction.intervalId,
          notificationId: restoredLaunchAction.notificationId,
          source,
        },
      );

      return restoredLaunchAction;
    },
    [],
  );

  const dismissCheckInFlow = useCallback(() => {
    const launchAction = pendingLaunchActionRef.current;
    const activeExpiredTimerSession = getExpiredTimerSession(
      notificationDocumentRef.current,
      launchAction,
    );

    activeLaunchActionKeyRef.current = null;
    setPendingLaunchAction(null);
    removeStartupNavigationRequest(CHECK_IN_REQUEST_ID);
    removeStartupNavigationRequest(PARENT_UNLOCK_REQUEST_ID);

    if (!activeExpiredTimerSession) {
      return;
    }

    log.info('Dismissed expired timer check-in flow', {
      intervalId: activeExpiredTimerSession.intervalId,
      resetSharedTimer: true,
    });
    resetSharedTimer();
    completeTemporaryLaunchIfNeeded(launchAction);
  }, [
    completeTemporaryLaunchIfNeeded,
    removeStartupNavigationRequest,
    resetSharedTimer,
  ]);

  const handleLaunchAction = useCallback(
    async (
      launchAction: PendingNotificationLaunchAction | null,
      source: 'event' | 'foreground-event' | 'resume' | 'startup',
    ) => {
      if (!launchAction) {
        return;
      }

      const launchActionKey = createLaunchActionKey(launchAction);

      if (
        launchActionKey &&
        launchActionKey === activeLaunchActionKeyRef.current
      ) {
        log.debug('Ignored duplicate notification launch action', {
          intervalId: launchAction.intervalId,
          notificationId: launchAction.notificationId,
          source,
        });
        return;
      }

      activeLaunchActionKeyRef.current = launchActionKey;

      log.info('Handling notification launch action', {
        intervalId: launchAction.intervalId,
        launchSource: launchAction.launchSource ?? null,
        notificationId: launchAction.notificationId,
        source,
      });
      if (
        source !== 'foreground-event' &&
        launchAction.launchSource !== 'full-screen-intent'
      ) {
        await stopExpiredAlarmPlayback();
      }
      setPendingLaunchAction(launchAction);

      if (!isParentUnlocked) {
        queueStartupNavigationRequest({
          href: buildParentUnlockHref(parentPin),
          id: PARENT_UNLOCK_REQUEST_ID,
          priority: 0,
          source: 'notifications',
          targetPathname: '/parent-unlock',
        });
        removeStartupNavigationRequest(CHECK_IN_REQUEST_ID);
        return;
      }
    },
    [
      isParentUnlocked,
      parentPin,
      queueStartupNavigationRequest,
      removeStartupNavigationRequest,
    ],
  );

  useEffect(() => {
    if (!isReady || hasInitialized) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      const persistedDocument = engineAvailable
        ? await loadPersistedNotificationDocument()
        : null;
      let nextDocument = deriveNotificationDocument(document, {
        existingDocument: persistedDocument,
        liveCountdownNotificationsEnabled,
      });

      if (engineAvailable && !persistedDocument) {
        const syncedDocument = await syncNotificationDocument(nextDocument);
        nextDocument =
          parseNotificationDocument(syncedDocument) ?? nextDocument;
      }

      if (isCancelled) {
        return;
      }

      setNotificationDocument(nextDocument);
      notificationDocumentRef.current = nextDocument;
      lastSyncedDocumentRef.current = persistedDocument ?? nextDocument;
      await refreshRuntimeStatus();

      if (!isCancelled) {
        setHasInitialized(true);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    document,
    engineAvailable,
    hasInitialized,
    isReady,
    liveCountdownNotificationsEnabled,
    refreshRuntimeStatus,
  ]);

  useEffect(() => {
    if (!isReady || !hasInitialized) {
      return;
    }

    const nextDocument = deriveNotificationDocument(document, {
      existingDocument: notificationDocumentRef.current,
      liveCountdownNotificationsEnabled,
    });
    const previousDocument =
      lastSyncedDocumentRef.current ?? notificationDocumentRef.current;

    if (
      previousDocument &&
      areNotificationDocumentsEqual(previousDocument, nextDocument)
    ) {
      if (
        !notificationDocumentRef.current ||
        !areNotificationDocumentsEqual(
          notificationDocumentRef.current,
          nextDocument,
        )
      ) {
        setNotificationDocument(nextDocument);
        notificationDocumentRef.current = nextDocument;
      }
      return;
    }

    setNotificationDocument(nextDocument);
    notificationDocumentRef.current = nextDocument;
    lastSyncedDocumentRef.current = nextDocument;

    if (!engineAvailable) {
      return;
    }

    void (async () => {
      let bridgeDocumentJson: string | null = null;

      if (!previousDocument) {
        bridgeDocumentJson = await syncNotificationDocument(nextDocument);
      } else if (
        previousDocument.head.timerState.isRunning !==
        nextDocument.head.timerState.isRunning
      ) {
        if (nextDocument.head.timerState.isRunning) {
          bridgeDocumentJson = await startNotificationTimer(nextDocument);
        } else if (nextDocument.head.timerState.pausedRemainingMs != null) {
          bridgeDocumentJson = await pauseNotificationTimer(nextDocument);
        } else {
          bridgeDocumentJson = await resetNotificationTimer(nextDocument);
        }
      } else {
        bridgeDocumentJson = await syncNotificationDocument(nextDocument);
      }

      if (bridgeDocumentJson) {
        applyNativeDocumentJson(bridgeDocumentJson, nextDocument);
      }

      await refreshRuntimeStatus();
    })();
  }, [
    applyNativeDocumentJson,
    document,
    engineAvailable,
    hasInitialized,
    isReady,
    liveCountdownNotificationsEnabled,
    refreshRuntimeStatus,
  ]);

  useEffect(() => {
    if (!isReady || !hasInitialized || !engineAvailable) {
      return;
    }

    let isCancelled = false;

    if (!didConsumeStartupLaunchActionRef.current) {
      didConsumeStartupLaunchActionRef.current = true;
      void consumePendingNotificationLaunchAction().then((launchAction) => {
        if (!isCancelled) {
          void handleLaunchAction(
            restoreMissedLaunchAction('startup', launchAction),
            'startup',
          );
        }
      });
    }

    const notificationStateSubscription = addNotificationStateChangeListener(
      ({
        document: nextDocument,
        reason,
        runtimeStatus: nextRuntimeStatus,
      }) => {
        if (isCancelled) {
          return;
        }

        log.info('Received notification state event', {
          expiredIntervals: nextDocument.head.expiredIntervals.length,
          reason,
          sessionId: nextRuntimeStatus.sessionId,
        });
        const mergedDocument = deriveNotificationDocument(
          sharedDocumentRef.current,
          {
            existingDocument: nextDocument,
            liveCountdownNotificationsEnabled:
              liveCountdownNotificationsEnabledRef.current,
          },
        );

        setNotificationDocument(mergedDocument);
        notificationDocumentRef.current = mergedDocument;
        lastSyncedDocumentRef.current = mergedDocument;
        setRuntimeStatus(nextRuntimeStatus);

        if (
          reason === 'interval-triggered' &&
          nextRuntimeStatus.isAppInForeground
        ) {
          const latestExpiredTimerSession =
            mergedDocument.head.expiredIntervals[
              mergedDocument.head.expiredIntervals.length - 1
            ] ?? null;
          const launchAction = latestExpiredTimerSession
            ? createPendingLaunchActionFromExpiredTimerSession(
                latestExpiredTimerSession,
              )
            : null;

          if (launchAction) {
            void handleLaunchAction(launchAction, 'foreground-event');
          }
        }

        if (
          reason === 'timer-paused-notification' &&
          sharedDocumentRef.current.head.timerState.mode === 'running'
        ) {
          pauseSharedTimer();
        }

        if (
          reason === 'timer-stopped' &&
          sharedDocumentRef.current.head.timerState.mode !== 'idle'
        ) {
          resetSharedTimer();
        }
      },
    );
    const launchActionSubscription = addNotificationLaunchActionListener(
      (launchAction) => {
        if (isCancelled) {
          return;
        }

        skipNextResumeConsumeRef.current = true;
        void handleLaunchAction(launchAction, 'event');
      },
    );
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (isCancelled || nextAppState !== 'active') {
          return;
        }

        void refreshRuntimeStatus();
        if (skipNextResumeConsumeRef.current) {
          skipNextResumeConsumeRef.current = false;
          return;
        }

        void consumePendingNotificationLaunchAction().then((launchAction) => {
          if (!isCancelled) {
            void handleLaunchAction(
              restoreMissedLaunchAction('resume', launchAction),
              'resume',
            );
          }
        });
      },
    );

    return () => {
      isCancelled = true;
      notificationStateSubscription?.remove();
      launchActionSubscription?.remove();
      appStateSubscription.remove();
    };
  }, [
    engineAvailable,
    handleLaunchAction,
    hasInitialized,
    isReady,
    pauseSharedTimer,
    refreshRuntimeStatus,
    resetSharedTimer,
    restoreMissedLaunchAction,
  ]);

  useEffect(() => {
    if (!pendingLaunchAction || !isParentUnlocked) {
      return;
    }

    const checkInRoute = getCheckInRouteForLaunchAction(pendingLaunchAction);
    removeStartupNavigationRequest(PARENT_UNLOCK_REQUEST_ID);
    queueStartupNavigationRequest({
      href: checkInRoute,
      id: CHECK_IN_REQUEST_ID,
      priority: 1,
      source: 'notifications',
      targetPathname: checkInRoute,
    });
  }, [
    isParentUnlocked,
    pendingLaunchAction,
    queueStartupNavigationRequest,
    removeStartupNavigationRequest,
  ]);

  const resolveExpiredTimerChild = useCallback(
    async (
      childId: string,
      status: 'awarded' | 'dismissed',
      options?: {
        restartTimerOnResolve?: boolean;
      },
    ) => {
      if (!isParentUnlocked) {
        queueStartupNavigationRequest({
          href: buildParentUnlockHref(parentPin),
          id: PARENT_UNLOCK_REQUEST_ID,
          priority: 0,
          source: 'notifications',
          targetPathname: '/parent-unlock',
        });
        return;
      }

      const activeExpiredTimerSession = getExpiredTimerSession(
        notificationDocumentRef.current,
        pendingLaunchActionRef.current,
      );
      const launchAction = pendingLaunchActionRef.current;

      if (!activeExpiredTimerSession) {
        return;
      }

      await stopExpiredAlarmPlayback();
      const shouldRestartTimer = options?.restartTimerOnResolve ?? true;

      const {
        childActions,
        didResolveSession,
        didUpdate,
        document: nextDocument,
      } = resolveExpiredTimerChildAction(notificationDocumentRef.current, {
        childId,
        intervalId: activeExpiredTimerSession.intervalId,
        status,
      });

      if (!didUpdate) {
        return;
      }

      log.info('Resolved expired timer child action', {
        childId,
        didResolveSession,
        intervalId: activeExpiredTimerSession.intervalId,
        restartTimerOnResolve: shouldRestartTimer,
        status,
      });
      setNotificationDocument(nextDocument);
      notificationDocumentRef.current = nextDocument;

      if (didResolveSession) {
        const resolvedChildDecisions =
          childActions?.flatMap((childAction) =>
            childAction.status === 'pending'
              ? []
              : [
                  {
                    childId: childAction.childId,
                    status: childAction.status,
                  },
                ],
          ) ?? [];

        if (resolvedChildDecisions.length > 0) {
          const resolveCheckInResult = resolveCheckInSession(
            resolvedChildDecisions,
          );

          if (!resolveCheckInResult.ok) {
            log.error('Failed to commit resolved check-in session', {
              childDecisions: resolvedChildDecisions,
              error: resolveCheckInResult.error,
              intervalId: activeExpiredTimerSession.intervalId,
            });
          }
        }

        activeLaunchActionKeyRef.current = null;
        setPendingLaunchAction(null);
        removeStartupNavigationRequest(CHECK_IN_REQUEST_ID);
        if (shouldRestartTimer) {
          startSharedTimer();
        } else {
          resetSharedTimer();
        }
        completeTemporaryLaunchIfNeeded(launchAction);
        return;
      }

      await syncResolvedDocument(nextDocument);
    },
    [
      isParentUnlocked,
      parentPin,
      completeTemporaryLaunchIfNeeded,
      queueStartupNavigationRequest,
      removeStartupNavigationRequest,
      resetSharedTimer,
      resolveCheckInSession,
      startSharedTimer,
      syncResolvedDocument,
    ],
  );

  const activeExpiredTimerSession = useMemo(
    () => getExpiredTimerSession(notificationDocument, pendingLaunchAction),
    [notificationDocument, pendingLaunchAction],
  );
  const contextValue = useMemo<NotificationsContextValue>(
    () => ({
      activeExpiredTimerSession,
      dismissCheckInFlow,
      engineAvailable,
      isReady: isReady && hasInitialized,
      liveCountdownNotificationsEnabled,
      openExactAlarmSettings,
      openFullScreenIntentSettings,
      openNotificationSettings,
      openPromotedNotificationSettings,
      refreshRuntimeStatus,
      requestTimerStart,
      resolveExpiredTimerChild,
      runtimeStatus,
      setLiveCountdownNotificationsEnabled,
    }),
    [
      activeExpiredTimerSession,
      dismissCheckInFlow,
      engineAvailable,
      hasInitialized,
      isReady,
      liveCountdownNotificationsEnabled,
      refreshRuntimeStatus,
      requestTimerStart,
      resolveExpiredTimerChild,
      runtimeStatus,
      setLiveCountdownNotificationsEnabled,
    ],
  );

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error(
      'useNotifications must be used within NotificationsProvider',
    );
  }

  return context;
}

function parseNotificationNativeLogContext(
  contextJson: string | null,
): AppLogDetails {
  if (!contextJson) {
    return {};
  }

  try {
    const parsedContext = JSON.parse(contextJson) as unknown;

    if (
      parsedContext &&
      typeof parsedContext === 'object' &&
      !Array.isArray(parsedContext)
    ) {
      return parsedContext as AppLogDetails;
    }

    return { nativeDetails: parsedContext };
  } catch {
    return { nativeDetails: contextJson };
  }
}
