import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, type AppStateStatus, useColorScheme } from 'react-native';
import { resolveThemeMode } from '../theme/theme';
import {
  type AlarmEngineRuntimeStatus,
  addAlarmEngineListener,
  getAlarmRuntimeStatus,
  pauseAlarmTimer,
  resetAlarmTimer,
  startAlarmTimer,
  stopExpiredAlarmPlayback,
  syncAlarmDocument,
} from './alarmEngine';
import { createInitialParentSession } from './parentSession';
import { appRepository } from './repository';
import { appDataReducer, sortChildren, verifyParentPin } from './state';
import { computeTimerSnapshot } from './timer';
import {
  commitSharedTransaction,
  createDefaultAppDocument,
  createEmptyTransactionState,
  getRestorePlan,
  getRevertPlan,
  getTransactionActorDeviceName,
  restoreTransaction as restoreSharedTransaction,
  revertTransaction as revertSharedTransaction,
  type TransactionRecord,
} from './transactions';
import type {
  ParentSession,
  PersistedAppData,
  ResolvedTheme,
  SharedTimerConfig,
  ThemeMode,
} from './types';

const ALARM_DEBUG_PREFIX = '[KidPointsAlarmJS]';

function logAlarmDebug(message: string, details?: unknown) {
  if (!__DEV__) {
    return;
  }

  if (details === undefined) {
    console.debug(ALARM_DEBUG_PREFIX, message);
    return;
  }

  console.debug(ALARM_DEBUG_PREFIX, message, details);
}

type AppStorageValue = {
  alarmRuntimeStatus: AlarmEngineRuntimeStatus;
  appData: PersistedAppData;
  archivedChildren: PersistedAppData['children'];
  children: PersistedAppData['children'];
  isHydrated: boolean;
  lockParent: () => void;
  parentSession: ParentSession;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  timerSnapshot: ReturnType<typeof computeTimerSnapshot>;
  themeMode: ThemeMode;
  transactions: TransactionRecord[];
  clearTransactionHistory: () => void;
  getRevertPlan: (threadId: string) => string[];
  getRestorePlan: (threadId: string) => string[];
  reloadPersistedState: () => Promise<void>;
  restoreTransaction: (threadId: string) => void;
  revertTransaction: (threadId: string) => void;
  refreshAlarmRuntimeStatus: () => Promise<void>;
  unlockParent: (pin: string) => boolean;
  addChild: (name: string) => void;
  awardExpiredIntervalChild: (intervalId: string, childId: string) => void;
  decrementPoints: (childId: string) => void;
  dismissExpiredIntervalChild: (intervalId: string, childId: string) => void;
  incrementPoints: (childId: string) => void;
  moveChild: (childId: string, direction: 'up' | 'down') => void;
  pauseTimer: () => void;
  renameChild: (childId: string, name: string) => void;
  archiveChild: (childId: string) => void;
  deleteChildPermanently: (childId: string) => void;
  resetTimer: () => void;
  restoreChild: (childId: string) => void;
  setPoints: (childId: string, points: number) => void;
  startTimer: () => void;
  updateTimerConfig: (patch: Partial<SharedTimerConfig>) => void;
};

const AppStorageContext = createContext<AppStorageValue | null>(null);

export function AppStorageProvider({ children }: PropsWithChildren) {
  const [document, setDocument] = useState(createDefaultAppDocument);
  const [alarmRuntimeStatus, setAlarmRuntimeStatus] =
    useState<AlarmEngineRuntimeStatus>({
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
      promotedNotificationSettingsResolvable: false,
      promotedNotificationPermissionGranted: false,
      sessionId: null,
    });
  const [parentSession, setParentSession] = useState<ParentSession>(
    createInitialParentSession,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [now, setNow] = useState(Date.now());
  const systemColorScheme = useColorScheme();
  const reloadPersistedState = useCallback(async () => {
    logAlarmDebug('Reloading persisted alarm state');
    const [loadedData, runtimeStatus] = await Promise.all([
      appRepository.load(),
      getAlarmRuntimeStatus(),
    ]);

    setDocument(loadedData);
    setAlarmRuntimeStatus(runtimeStatus);
    logAlarmDebug('Reloaded persisted alarm state', {
      expiredIntervals: loadedData.head.expiredIntervals.length,
      isRunning: runtimeStatus.isRunning,
      sessionId: runtimeStatus.sessionId,
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    reloadPersistedState().then(() => {
      if (!isMounted) {
        return;
      }

      setIsHydrated(true);
      logAlarmDebug('App storage hydrated');
    });

    return () => {
      isMounted = false;
    };
  }, [reloadPersistedState]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void appRepository.save(document);
    void syncAlarmDocument(document);
  }, [document, isHydrated]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const subscription = addAlarmEngineListener((event) => {
      logAlarmDebug('Received native alarm engine state event', {
        expiredIntervals: event.document.head.expiredIntervals.length,
        reason: event.reason,
        sessionId: event.runtimeStatus.sessionId,
      });
      setDocument(event.document);
      setAlarmRuntimeStatus(event.runtimeStatus);
    });

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        logAlarmDebug('AppState changed', { nextAppState });
        if (nextAppState !== 'active') {
          return;
        }

        void reloadPersistedState();
      },
    );

    return () => {
      subscription?.remove();
      appStateSubscription.remove();
    };
  }, [reloadPersistedState]);

  const value = useMemo<AppStorageValue>(() => {
    const appData = document.head;
    const children = sortChildren(
      appData.children.filter((child) => !child.isArchived),
    );
    const archivedChildren = [...appData.children]
      .filter((child) => child.isArchived)
      .sort((left, right) => (right.archivedAt ?? 0) - (left.archivedAt ?? 0));
    const resolvedTheme = resolveThemeMode(
      appData.uiPreferences.themeMode,
      systemColorScheme,
    );
    const timerSnapshot = computeTimerSnapshot(
      appData.timerConfig,
      appData.timerState,
      appData.timerRuntimeState,
      now,
    );
    const actorDeviceName = getTransactionActorDeviceName();
    const refreshAlarmRuntimeStatus = async () => {
      setAlarmRuntimeStatus(await getAlarmRuntimeStatus());
    };
    const updateHead = (
      updater: (currentHead: PersistedAppData) => PersistedAppData,
    ) => {
      const nextDocument = {
        ...document,
        head: updater(document.head),
      };

      setDocument(nextDocument);

      return nextDocument;
    };
    const commit = (intent: Parameters<typeof commitSharedTransaction>[1]) => {
      const nextDocument = commitSharedTransaction(document, intent, {
        actorDeviceName,
        occurredAt: Date.now(),
      });

      setDocument(nextDocument);

      return nextDocument;
    };

    return {
      alarmRuntimeStatus,
      appData,
      archivedChildren,
      children,
      isHydrated,
      lockParent: () => {
        setParentSession({ isUnlocked: false });
      },
      parentSession,
      reloadPersistedState,
      resolvedTheme,
      setThemeMode: (themeMode) => {
        updateHead((currentHead) =>
          appDataReducer(currentHead, {
            type: 'setThemeMode',
            themeMode,
          }),
        );
      },
      timerSnapshot,
      themeMode: appData.uiPreferences.themeMode,
      transactions: [...document.transactionState.transactions],
      clearTransactionHistory: () => {
        setDocument((current) => ({
          ...current,
          transactionState: createEmptyTransactionState(
            current.transactionState.clientState.deviceId,
          ),
        }));
      },
      getRevertPlan: (threadId) =>
        getRevertPlan(document.transactionState, threadId).transactionIds,
      getRestorePlan: (threadId) =>
        getRestorePlan(document.transactionState, threadId).transactionIds,
      restoreTransaction: (threadId) => {
        setDocument((current) =>
          restoreSharedTransaction(current, threadId, {
            actorDeviceName,
            occurredAt: Date.now(),
          }),
        );
      },
      revertTransaction: (threadId) => {
        setDocument((current) =>
          revertSharedTransaction(current, threadId, {
            actorDeviceName,
            occurredAt: Date.now(),
          }),
        );
      },
      refreshAlarmRuntimeStatus,
      unlockParent: (pin) => {
        const success = verifyParentPin(appData, pin);

        if (success) {
          setParentSession({ isUnlocked: true });
        }

        return success;
      },
      addChild: (name) => {
        if (!name.trim()) {
          return;
        }

        commit({ type: 'addChild', name });
      },
      awardExpiredIntervalChild: (intervalId, childId) => {
        logAlarmDebug('Awarding child from check-in modal', {
          childId,
          intervalId,
        });
        void stopExpiredAlarmPlayback();
        const targetInterval = appData.expiredIntervals.find(
          (interval) => interval.intervalId === intervalId,
        );
        const targetAction = targetInterval?.childActions.find(
          (childAction) => childAction.childId === childId,
        );

        if (
          !targetInterval ||
          !targetAction ||
          targetAction.status !== 'pending'
        ) {
          return;
        }

        const occurredAt = Date.now();
        let nextDocument = commitSharedTransaction(
          document,
          {
            type: 'incrementPoints',
            amount: 1,
            childId,
          },
          {
            actorDeviceName,
            occurredAt,
          },
        );

        nextDocument = {
          ...nextDocument,
          head: appDataReducer(nextDocument.head, {
            type: 'setExpiredIntervalChildStatus',
            childId,
            intervalId,
            status: 'awarded',
          }),
        };

        const shouldRestartTimer = !nextDocument.head.timerState.isRunning;

        if (shouldRestartTimer) {
          nextDocument = commitSharedTransaction(
            nextDocument,
            {
              type: 'startTimer',
              startedAt: occurredAt,
            },
            {
              actorDeviceName,
              occurredAt,
            },
          );
        }

        setDocument(nextDocument);

        if (shouldRestartTimer) {
          void startAlarmTimer(nextDocument).then((serializedDocument) => {
            setDocument(JSON.parse(serializedDocument) as typeof nextDocument);
            void refreshAlarmRuntimeStatus();
          });
          return;
        }

        void syncAlarmDocument(nextDocument).then((serializedDocument) => {
          setDocument(JSON.parse(serializedDocument) as typeof nextDocument);
          void refreshAlarmRuntimeStatus();
        });
      },
      decrementPoints: (childId) => {
        commit({ type: 'decrementPoints', amount: 1, childId });
      },
      dismissExpiredIntervalChild: (intervalId, childId) => {
        logAlarmDebug('Dismissing child from check-in modal', {
          childId,
          intervalId,
        });
        void stopExpiredAlarmPlayback();
        const targetInterval = appData.expiredIntervals.find(
          (interval) => interval.intervalId === intervalId,
        );
        const targetAction = targetInterval?.childActions.find(
          (childAction) => childAction.childId === childId,
        );

        if (
          !targetInterval ||
          !targetAction ||
          targetAction.status !== 'pending'
        ) {
          return;
        }

        const occurredAt = Date.now();
        let nextDocument = {
          ...document,
          head: appDataReducer(document.head, {
            type: 'setExpiredIntervalChildStatus',
            childId,
            intervalId,
            status: 'dismissed',
          }),
        };

        const shouldRestartTimer = !nextDocument.head.timerState.isRunning;

        if (shouldRestartTimer) {
          nextDocument = commitSharedTransaction(
            nextDocument,
            {
              type: 'startTimer',
              startedAt: occurredAt,
            },
            {
              actorDeviceName,
              occurredAt,
            },
          );
        }

        setDocument(nextDocument);

        if (shouldRestartTimer) {
          void startAlarmTimer(nextDocument).then((serializedDocument) => {
            setDocument(JSON.parse(serializedDocument) as typeof nextDocument);
            void refreshAlarmRuntimeStatus();
          });
          return;
        }

        void syncAlarmDocument(nextDocument).then((serializedDocument) => {
          setDocument(JSON.parse(serializedDocument) as typeof nextDocument);
          void refreshAlarmRuntimeStatus();
        });
      },
      incrementPoints: (childId) => {
        commit({ type: 'incrementPoints', amount: 1, childId });
      },
      moveChild: (childId, direction) => {
        commit({ type: 'moveChild', childId, direction });
      },
      pauseTimer: () => {
        logAlarmDebug('Pause timer requested from JS');
        const nextDocument = commit({
          type: 'pauseTimer',
          pausedAt: Date.now(),
        });

        void pauseAlarmTimer(nextDocument).then((serializedDocument) => {
          setDocument(JSON.parse(serializedDocument) as typeof nextDocument);
          void refreshAlarmRuntimeStatus();
        });
      },
      renameChild: (childId, name) => {
        if (!name.trim()) {
          return;
        }

        commit({ type: 'renameChild', childId, name });
      },
      archiveChild: (childId) => {
        commit({ type: 'archiveChild', childId, archivedAt: Date.now() });
      },
      deleteChildPermanently: (childId) => {
        commit({ type: 'deleteChildPermanently', childId });
      },
      resetTimer: () => {
        logAlarmDebug('Reset timer requested from JS');
        const nextDocument = commit({ type: 'resetTimer' });

        void resetAlarmTimer(nextDocument).then((serializedDocument) => {
          setDocument(JSON.parse(serializedDocument) as typeof nextDocument);
          void refreshAlarmRuntimeStatus();
        });
      },
      restoreChild: (childId) => {
        commit({ type: 'restoreChild', childId });
      },
      setPoints: (childId, points) => {
        commit({ type: 'setPoints', childId, points });
      },
      startTimer: () => {
        logAlarmDebug('Start timer requested from JS');
        const nextDocument = commit({
          type: 'startTimer',
          startedAt: Date.now(),
        });

        void startAlarmTimer(nextDocument).then((serializedDocument) => {
          setDocument(JSON.parse(serializedDocument) as typeof nextDocument);
          void refreshAlarmRuntimeStatus();
        });
      },
      updateTimerConfig: (patch) => {
        const nextDocument = updateHead((currentHead) =>
          appDataReducer(currentHead, {
            type: 'updateTimerConfig',
            patch,
          }),
        );
        void syncAlarmDocument(nextDocument).then((serializedDocument) => {
          setDocument(JSON.parse(serializedDocument) as typeof nextDocument);
          void refreshAlarmRuntimeStatus();
        });
      },
    };
  }, [
    alarmRuntimeStatus,
    document,
    isHydrated,
    now,
    parentSession,
    reloadPersistedState,
    systemColorScheme,
  ]);

  return (
    <AppStorageContext.Provider value={value}>
      {children}
    </AppStorageContext.Provider>
  );
}

export function useAppStorage() {
  const context = useContext(AppStorageContext);

  if (!context) {
    throw new Error('useAppStorage must be used inside AppStorageProvider');
  }

  return context;
}
