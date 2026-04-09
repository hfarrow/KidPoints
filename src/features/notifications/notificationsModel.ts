import { computeSharedTimerSnapshot } from '../../state/sharedTimer';
import type {
  SharedDocument,
  SharedTimerConfig,
  SharedTimerState,
} from '../../state/sharedTypes';

export type NotificationRuntimeStatus = {
  countdownNotificationChannelImportance: number | null;
  countdownNotificationHasPromotableCharacteristics: boolean;
  countdownNotificationIsOngoing: boolean;
  countdownNotificationRequestedPromoted: boolean;
  countdownNotificationUsesChronometer: boolean;
  countdownNotificationWhen: number | null;
  exactAlarmPermissionGranted: boolean;
  expiredNotificationCategory: string | null;
  expiredNotificationChannelImportance: number | null;
  expiredNotificationHasCustomHeadsUp: boolean;
  expiredNotificationHasFullScreenIntent: boolean;
  fullScreenIntentPermissionGranted: boolean;
  fullScreenIntentSettingsResolvable: boolean;
  isAppInForeground: boolean;
  isRunning: boolean;
  lastTriggeredAt: number | null;
  nextTriggerAt: number | null;
  notificationPermissionGranted: boolean;
  promotedNotificationSettingsResolvable: boolean;
  promotedNotificationPermissionGranted: boolean;
  sessionId: string | null;
};

export type PendingNotificationLaunchAction = {
  intervalId: string | null;
  notificationId: number | null;
  sessionId: string | null;
  triggeredAt: number | null;
  type: 'check-in';
};

export type NotificationChildSnapshot = {
  displayName: string;
  id: string;
  isArchived: boolean;
};

export type NotificationTimerConfig = {
  alarmDurationSeconds: number;
  intervalMinutes: number;
  intervalSeconds: number;
  notificationsEnabled: boolean;
};

export type NotificationTimerState = {
  activeIntervalMs: number | null;
  cycleStartedAt: number | null;
  isRunning: boolean;
  pausedRemainingMs: number | null;
};

export type NotificationTimerRuntimeState = {
  lastTriggeredAt: number | null;
  nextTriggerAt: number | null;
  sessionId: string | null;
};

export type ExpiredTimerChildActionStatus = 'awarded' | 'dismissed' | 'pending';

export type ExpiredTimerChildAction = {
  childId: string;
  childName: string;
  status: ExpiredTimerChildActionStatus;
};

export type ExpiredTimerSession = {
  childActions: ExpiredTimerChildAction[];
  intervalId: string;
  notificationId: number;
  sessionId: string;
  triggeredAt: number;
};

export type NotificationHead = {
  children: NotificationChildSnapshot[];
  expiredIntervals: ExpiredTimerSession[];
  timerConfig: NotificationTimerConfig;
  timerRuntimeState: NotificationTimerRuntimeState;
  timerState: NotificationTimerState;
};

export type NotificationDocument = {
  head: NotificationHead;
  schemaVersion: 1;
};

export function createDefaultNotificationRuntimeStatus(): NotificationRuntimeStatus {
  return {
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
  };
}

export function createEmptyNotificationDocument(): NotificationDocument {
  return {
    head: {
      children: [],
      expiredIntervals: [],
      timerConfig: {
        alarmDurationSeconds: 20,
        intervalMinutes: 15,
        intervalSeconds: 0,
        notificationsEnabled: true,
      },
      timerRuntimeState: createEmptyNotificationTimerRuntimeState(),
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

export function createEmptyNotificationTimerRuntimeState(): NotificationTimerRuntimeState {
  return {
    lastTriggeredAt: null,
    nextTriggerAt: null,
    sessionId: null,
  };
}

export function cloneNotificationDocument(
  document: NotificationDocument | null | undefined,
): NotificationDocument {
  const source = document ?? createEmptyNotificationDocument();

  return {
    head: {
      children: source.head.children.map((child) => ({ ...child })),
      expiredIntervals: source.head.expiredIntervals.map((interval) => ({
        ...interval,
        childActions: interval.childActions.map((childAction) => ({
          ...childAction,
        })),
      })),
      timerConfig: { ...source.head.timerConfig },
      timerRuntimeState: { ...source.head.timerRuntimeState },
      timerState: { ...source.head.timerState },
    },
    schemaVersion: 1,
  };
}

export function parseNotificationDocument(
  documentJson: string | null,
): NotificationDocument | null {
  if (!documentJson) {
    return null;
  }

  let parsedValue: Partial<NotificationDocument>;

  try {
    parsedValue = JSON.parse(documentJson) as Partial<NotificationDocument>;
  } catch {
    return null;
  }
  const head = (parsedValue.head ?? {}) as Partial<NotificationHead>;
  const fallback = createEmptyNotificationDocument();

  return {
    head: {
      children: Array.isArray(head.children)
        ? head.children.map((child) => ({
            displayName:
              typeof child?.displayName === 'string' ? child.displayName : '',
            id: typeof child?.id === 'string' ? child.id : '',
            isArchived: Boolean(child?.isArchived),
          }))
        : fallback.head.children,
      expiredIntervals: Array.isArray(head.expiredIntervals)
        ? (head.expiredIntervals
            .map((interval) => {
              const sessionId = normalizeSessionId(interval?.sessionId);

              if (
                typeof interval?.intervalId !== 'string' ||
                typeof interval?.notificationId !== 'number' ||
                !sessionId ||
                typeof interval?.triggeredAt !== 'number'
              ) {
                return null;
              }

              return {
                childActions: Array.isArray(interval.childActions)
                  ? interval.childActions.map((childAction) => ({
                      childId:
                        typeof childAction?.childId === 'string'
                          ? childAction.childId
                          : '',
                      childName:
                        typeof childAction?.childName === 'string'
                          ? childAction.childName
                          : '',
                      status:
                        childAction?.status === 'awarded' ||
                        childAction?.status === 'dismissed'
                          ? childAction.status
                          : 'pending',
                    }))
                  : [],
                intervalId: interval.intervalId,
                notificationId: interval.notificationId,
                sessionId,
                triggeredAt: interval.triggeredAt,
              } satisfies ExpiredTimerSession;
            })
            .filter(Boolean) as ExpiredTimerSession[])
        : fallback.head.expiredIntervals,
      timerConfig: parseNotificationTimerConfig(head.timerConfig),
      timerRuntimeState: {
        lastTriggeredAt:
          typeof head.timerRuntimeState?.lastTriggeredAt === 'number'
            ? head.timerRuntimeState.lastTriggeredAt
            : null,
        nextTriggerAt:
          typeof head.timerRuntimeState?.nextTriggerAt === 'number'
            ? head.timerRuntimeState.nextTriggerAt
            : null,
        sessionId: normalizeSessionId(head.timerRuntimeState?.sessionId),
      },
      timerState: parseNotificationTimerState(head.timerState),
    },
    schemaVersion: 1,
  };
}

function normalizeSessionId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue || normalizedValue === 'null') {
    return null;
  }

  return normalizedValue;
}

function parseNotificationTimerConfig(
  timerConfig: Partial<NotificationTimerConfig> | null | undefined,
): NotificationTimerConfig {
  const fallback = createEmptyNotificationDocument().head.timerConfig;

  return {
    alarmDurationSeconds:
      typeof timerConfig?.alarmDurationSeconds === 'number'
        ? timerConfig.alarmDurationSeconds
        : fallback.alarmDurationSeconds,
    intervalMinutes:
      typeof timerConfig?.intervalMinutes === 'number'
        ? timerConfig.intervalMinutes
        : fallback.intervalMinutes,
    intervalSeconds:
      typeof timerConfig?.intervalSeconds === 'number'
        ? timerConfig.intervalSeconds
        : fallback.intervalSeconds,
    notificationsEnabled:
      typeof timerConfig?.notificationsEnabled === 'boolean'
        ? timerConfig.notificationsEnabled
        : fallback.notificationsEnabled,
  };
}

function parseNotificationTimerState(
  timerState: Partial<NotificationTimerState> | null | undefined,
): NotificationTimerState {
  return {
    activeIntervalMs:
      typeof timerState?.activeIntervalMs === 'number'
        ? timerState.activeIntervalMs
        : null,
    cycleStartedAt:
      typeof timerState?.cycleStartedAt === 'number'
        ? timerState.cycleStartedAt
        : null,
    isRunning: Boolean(timerState?.isRunning),
    pausedRemainingMs:
      typeof timerState?.pausedRemainingMs === 'number'
        ? timerState.pausedRemainingMs
        : null,
  };
}

function buildNotificationTimerState(
  timerConfig: SharedTimerConfig,
  timerState: SharedTimerState,
): NotificationTimerState {
  const snapshot = computeSharedTimerSnapshot(
    timerConfig,
    timerState,
    Date.now(),
  );

  switch (snapshot.status) {
    case 'running':
      return {
        activeIntervalMs: snapshot.intervalMs,
        cycleStartedAt: snapshot.currentCycleStartedAt,
        isRunning: true,
        pausedRemainingMs: null,
      };
    case 'paused':
      return {
        activeIntervalMs: snapshot.intervalMs,
        cycleStartedAt: null,
        isRunning: false,
        pausedRemainingMs: snapshot.remainingMs,
      };
    default:
      return {
        activeIntervalMs: null,
        cycleStartedAt: null,
        isRunning: false,
        pausedRemainingMs: null,
      };
  }
}

function hasStaleExpiredNotificationState(
  snapshotStatus: ReturnType<typeof computeSharedTimerSnapshot>['status'],
  document: NotificationDocument,
) {
  return (
    snapshotStatus !== 'expired' && document.head.expiredIntervals.length > 0
  );
}

function buildNotificationTimerConfig(
  timerConfig: SharedTimerConfig,
  notificationsEnabled: boolean,
): NotificationTimerConfig {
  return {
    alarmDurationSeconds: timerConfig.alarmDurationSeconds,
    intervalMinutes: timerConfig.intervalMinutes,
    intervalSeconds: timerConfig.intervalSeconds,
    notificationsEnabled,
  };
}

export function deriveNotificationDocument(
  sharedDocument: SharedDocument,
  options: {
    existingDocument?: NotificationDocument | null;
    notificationsEnabled: boolean;
  },
): NotificationDocument {
  const { existingDocument, notificationsEnabled } = options;
  const currentDocument = cloneNotificationDocument(existingDocument);
  const timerSnapshot = notificationsEnabled
    ? computeSharedTimerSnapshot(
        sharedDocument.head.timerConfig,
        sharedDocument.head.timerState,
        Date.now(),
      )
    : null;
  const shouldClearExpiredNotificationState =
    notificationsEnabled &&
    timerSnapshot != null &&
    hasStaleExpiredNotificationState(timerSnapshot.status, currentDocument);
  const timerRuntimeState = !notificationsEnabled
    ? createEmptyNotificationTimerRuntimeState()
    : shouldClearExpiredNotificationState
      ? createEmptyNotificationTimerRuntimeState()
      : currentDocument.head.timerRuntimeState;
  const timerState =
    notificationsEnabled && timerSnapshot
      ? buildNotificationTimerState(
          sharedDocument.head.timerConfig,
          sharedDocument.head.timerState,
        )
      : createEmptyNotificationDocument().head.timerState;
  const expiredIntervals =
    notificationsEnabled && !shouldClearExpiredNotificationState
      ? currentDocument.head.expiredIntervals
      : [];

  return {
    head: {
      children: sharedDocument.head.activeChildIds
        .map((childId) => sharedDocument.head.childrenById[childId])
        .filter(Boolean)
        .map((child) => ({
          displayName: child.name,
          id: child.id,
          isArchived: false,
        })),
      expiredIntervals,
      timerConfig: buildNotificationTimerConfig(
        sharedDocument.head.timerConfig,
        notificationsEnabled,
      ),
      timerRuntimeState,
      timerState,
    },
    schemaVersion: 1,
  };
}

export function areNotificationDocumentsEqual(
  left: NotificationDocument | null | undefined,
  right: NotificationDocument | null | undefined,
) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function getExpiredTimerSession(
  document: NotificationDocument | null | undefined,
  launchAction: PendingNotificationLaunchAction | null | undefined,
): ExpiredTimerSession | null {
  const expiredIntervals = document?.head.expiredIntervals ?? [];

  if (!launchAction?.intervalId) {
    return null;
  }

  return (
    expiredIntervals.find(
      (expiredInterval) =>
        expiredInterval.intervalId === launchAction.intervalId,
    ) ?? null
  );
}

export function resolveExpiredTimerChildAction(
  document: NotificationDocument,
  options: {
    childId: string;
    intervalId: string;
    status: Extract<ExpiredTimerChildActionStatus, 'awarded' | 'dismissed'>;
  },
): {
  childActions: ExpiredTimerChildAction[] | null;
  didResolveSession: boolean;
  didUpdate: boolean;
  document: NotificationDocument;
} {
  const { childId, intervalId, status } = options;
  let nextChildActions: ExpiredTimerChildAction[] | null = null;
  let didUpdate = false;
  let didResolveSession = false;

  const expiredIntervals = document.head.expiredIntervals.flatMap(
    (interval) => {
      if (interval.intervalId !== intervalId) {
        return [
          {
            ...interval,
            childActions: interval.childActions.map((childAction) => ({
              ...childAction,
            })),
          },
        ];
      }

      const childActions = interval.childActions.map((childAction) => {
        if (childAction.childId !== childId || childAction.status === status) {
          return { ...childAction };
        }

        didUpdate = true;

        return {
          ...childAction,
          status,
        };
      });
      nextChildActions = childActions.map((childAction) => ({
        ...childAction,
      }));
      const hasPendingAction = childActions.some(
        (childAction) => childAction.status === 'pending',
      );

      if (!hasPendingAction) {
        didResolveSession = true;
        return [];
      }

      return [
        {
          ...interval,
          childActions,
        },
      ];
    },
  );

  return {
    childActions: nextChildActions,
    didResolveSession,
    didUpdate,
    document: {
      head: {
        ...cloneNotificationDocument(document).head,
        expiredIntervals,
        timerRuntimeState: didResolveSession
          ? createEmptyNotificationTimerRuntimeState()
          : { ...document.head.timerRuntimeState },
      },
      schemaVersion: 1,
    },
  };
}
