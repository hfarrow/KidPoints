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
import { AppState, type AppStateStatus } from 'react-native';
import {
  type AppLogDetails,
  createModuleLogger,
  logForwardedNativeEntry,
} from '../../logging/logger';
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
  deriveNotificationDocument,
  type ExpiredTimerSession,
  getExpiredTimerSession,
  type NotificationDocument,
  type NotificationRuntimeStatus,
  type PendingNotificationLaunchAction,
  parseNotificationDocument,
  resolveExpiredTimerChildAction,
} from './notificationsModel';

const CHECK_IN_ROUTE = '/timer-check-in';
const CHECK_IN_REQUEST_ID = 'notifications-check-in';
const PARENT_UNLOCK_REQUEST_ID = 'notifications-parent-unlock';
const log = createModuleLogger('notifications-provider');
const nativeLog = createModuleLogger('notifications-native');

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
  notificationsEnabled: boolean;
  openExactAlarmSettings: () => Promise<void>;
  openFullScreenIntentSettings: () => Promise<void>;
  openNotificationSettings: () => Promise<void>;
  openPromotedNotificationSettings: () => Promise<void>;
  refreshRuntimeStatus: () => Promise<NotificationRuntimeStatus>;
  resolveExpiredTimerChild: (
    childId: string,
    status: 'awarded' | 'dismissed',
    options?: {
      restartTimerOnResolve?: boolean;
    },
  ) => Promise<void>;
  runtimeStatus: NotificationRuntimeStatus;
  setNotificationsEnabled: (notificationsEnabled: boolean) => void;
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

function createPendingLaunchActionFromExpiredSession(
  expiredTimerSession: ExpiredTimerSession | null | undefined,
): PendingNotificationLaunchAction | null {
  if (!expiredTimerSession) {
    return null;
  }

  return {
    intervalId: expiredTimerSession.intervalId,
    notificationId: expiredTimerSession.notificationId,
    sessionId: expiredTimerSession.sessionId,
    triggeredAt: expiredTimerSession.triggeredAt,
    type: 'check-in',
  };
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
  const notificationsEnabled = useLocalSettingsStore(
    (state) => state.notificationsEnabled,
  );
  const parentPin = useLocalSettingsStore((state) => state.parentPin);
  const setNotificationsEnabled = useLocalSettingsStore(
    (state) => state.setNotificationsEnabled,
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
  const notificationsEnabledRef = useRef(notificationsEnabled);
  const didEvaluateStartupNotificationPermissionRef = useRef(false);
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
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  const forwardNotificationNativeLog = useCallback(
    (entry: NotificationNativeLogEntry) => {
      if (entry.sequence <= lastSeenNativeLogSequenceRef.current) {
        return;
      }

      lastSeenNativeLogSequenceRef.current = entry.sequence;
      logForwardedNativeEntry(
        nativeLog,
        entry,
        parseNotificationNativeLogContext(entry.contextJson),
      );
    },
    [],
  );

  useEffect(() => {
    if (!engineAvailable) {
      return;
    }

    let isCancelled = false;
    let hasReplayedBufferedLogs = false;
    const queuedLiveEntries: NotificationNativeLogEntry[] = [];
    const handleLogEntry = (entry: NotificationNativeLogEntry) => {
      if (isCancelled) {
        return;
      }

      if (!hasReplayedBufferedLogs) {
        queuedLiveEntries.push(entry);
        return;
      }

      forwardNotificationNativeLog(entry);
    };
    const logSubscription = addNotificationLogListener(handleLogEntry);
    const bufferedLogEntries = getBufferedNotificationLogs(
      lastSeenNativeLogSequenceRef.current,
    );

    bufferedLogEntries
      .sort(
        (firstEntry, secondEntry) => firstEntry.sequence - secondEntry.sequence,
      )
      .forEach(forwardNotificationNativeLog);
    hasReplayedBufferedLogs = true;
    queuedLiveEntries
      .sort(
        (firstEntry, secondEntry) => firstEntry.sequence - secondEntry.sequence,
      )
      .forEach(forwardNotificationNativeLog);

    return () => {
      isCancelled = true;
      logSubscription?.remove();
    };
  }, [engineAvailable, forwardNotificationNativeLog]);

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

  const maybeRequestStartupNotificationPermission = useCallback(
    async (runtimeStatus: NotificationRuntimeStatus, source: 'startup') => {
      if (didEvaluateStartupNotificationPermissionRef.current) {
        return runtimeStatus;
      }

      didEvaluateStartupNotificationPermissionRef.current = true;

      if (!engineAvailable) {
        log.debug('Skipped notification permission request', {
          reason: 'native-module-unavailable',
          source,
        });
        return runtimeStatus;
      }

      if (!notificationsEnabled) {
        log.debug('Skipped notification permission request', {
          reason: 'notifications-disabled',
          source,
        });
        return runtimeStatus;
      }

      if (runtimeStatus.notificationPermissionGranted) {
        log.debug('Skipped notification permission request', {
          reason: 'already-granted',
          source,
        });
        return runtimeStatus;
      }

      log.info('Requesting notification permission from provider', {
        source,
      });
      await requestNotificationPermission();
      return refreshRuntimeStatus();
    },
    [engineAvailable, notificationsEnabled, refreshRuntimeStatus],
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

  const dismissCheckInFlow = useCallback(() => {
    const activeExpiredTimerSession = getExpiredTimerSession(
      notificationDocumentRef.current,
      pendingLaunchActionRef.current,
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
  }, [removeStartupNavigationRequest, resetSharedTimer]);

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
        notificationId: launchAction.notificationId,
        source,
      });
      if (source !== 'foreground-event') {
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
        notificationsEnabled,
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
      const nextRuntimeStatus = await refreshRuntimeStatus();
      await maybeRequestStartupNotificationPermission(
        nextRuntimeStatus,
        'startup',
      );

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
    maybeRequestStartupNotificationPermission,
    notificationsEnabled,
    refreshRuntimeStatus,
  ]);

  useEffect(() => {
    if (!isReady || !hasInitialized) {
      return;
    }

    const nextDocument = deriveNotificationDocument(document, {
      existingDocument: notificationDocumentRef.current,
      notificationsEnabled,
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

      if (!notificationsEnabled) {
        bridgeDocumentJson = await resetNotificationTimer(nextDocument);
      } else if (!previousDocument) {
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
    notificationsEnabled,
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
          void handleLaunchAction(launchAction, 'startup');
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
            notificationsEnabled: notificationsEnabledRef.current,
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
          const launchAction = createPendingLaunchActionFromExpiredSession(
            latestExpiredTimerSession,
          );

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
            void handleLaunchAction(launchAction, 'resume');
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
  ]);

  useEffect(() => {
    if (!pendingLaunchAction || !isParentUnlocked) {
      return;
    }

    removeStartupNavigationRequest(PARENT_UNLOCK_REQUEST_ID);
    queueStartupNavigationRequest({
      href: CHECK_IN_ROUTE,
      id: CHECK_IN_REQUEST_ID,
      priority: 1,
      source: 'notifications',
      targetPathname: CHECK_IN_ROUTE,
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
        return;
      }

      await syncResolvedDocument(nextDocument);
    },
    [
      isParentUnlocked,
      parentPin,
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
      notificationsEnabled,
      openExactAlarmSettings,
      openFullScreenIntentSettings,
      openNotificationSettings,
      openPromotedNotificationSettings,
      refreshRuntimeStatus,
      resolveExpiredTimerChild,
      runtimeStatus,
      setNotificationsEnabled,
    }),
    [
      activeExpiredTimerSession,
      dismissCheckInFlow,
      engineAvailable,
      hasInitialized,
      isReady,
      notificationsEnabled,
      refreshRuntimeStatus,
      resolveExpiredTimerChild,
      runtimeStatus,
      setNotificationsEnabled,
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
