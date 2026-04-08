import {
  type EventSubscription,
  type NativeModule,
  requireOptionalNativeModule,
} from 'expo-modules-core';
import { PermissionsAndroid, Platform } from 'react-native';
import { createModuleLogger } from '../../logging/logger';
import {
  createDefaultNotificationRuntimeStatus,
  type NotificationDocument,
  type NotificationRuntimeStatus,
  type PendingNotificationLaunchAction,
  parseNotificationDocument,
} from './notificationsModel';

type NotificationStateChangedEvent = {
  documentJson: string;
  reason: string;
  runtimeStatusJson: string;
};

type NotificationLaunchActionEvent = {
  actionJson: string;
};

const log = createModuleLogger('notifications-bridge');

type NotificationsNativeModule = NativeModule<{
  KidPointsNotificationsLaunchAction: (
    event: NotificationLaunchActionEvent,
  ) => void;
  KidPointsNotificationsStateChanged: (
    event: NotificationStateChangedEvent,
  ) => void;
}> & {
  addListener: (
    eventName:
      | 'KidPointsNotificationsLaunchAction'
      | 'KidPointsNotificationsStateChanged',
    listener:
      | ((event: NotificationLaunchActionEvent) => void)
      | ((event: NotificationStateChangedEvent) => void),
  ) => EventSubscription;
  canScheduleExactAlarms: () => Promise<boolean>;
  consumePendingLaunchAction: () => Promise<string | null>;
  getDocument: () => Promise<string | null>;
  getPendingLaunchAction: () => Promise<string | null>;
  getRuntimeStatus: () => Promise<string>;
  openExactAlarmSettings: () => Promise<void>;
  openFullScreenIntentSettings: () => Promise<void>;
  openNotificationSettings: () => Promise<void>;
  openPromotedNotificationSettings: () => Promise<void>;
  pauseTimer: (documentJson: string) => Promise<string>;
  resetTimer: (documentJson: string) => Promise<string>;
  saveDocument: (documentJson: string) => Promise<string>;
  startTimer: (documentJson: string) => Promise<string>;
  stopExpiredAlarmPlayback: () => Promise<void>;
  syncDocument: (documentJson: string) => Promise<string>;
};

const nativeModuleRef = requireOptionalNativeModule<NotificationsNativeModule>(
  'KidPointsNotifications',
);

export function isNotificationsModuleAvailable() {
  return Boolean(nativeModuleRef);
}

function logModuleUnavailable(method: string) {
  log.debug('Notifications bridge unavailable; using fallback', { method });
}

export async function loadPersistedNotificationDocument() {
  if (!nativeModuleRef) {
    logModuleUnavailable('loadPersistedNotificationDocument');
    return null;
  }

  log.debug('Loading persisted notification document');
  return parseNotificationDocument(await nativeModuleRef.getDocument());
}

export async function getPendingNotificationLaunchAction() {
  if (!nativeModuleRef) {
    logModuleUnavailable('getPendingNotificationLaunchAction');
    return null;
  }

  log.debug('Reading pending notification launch action');
  return parsePendingNotificationLaunchAction(
    await nativeModuleRef.getPendingLaunchAction(),
  );
}

export async function consumePendingNotificationLaunchAction() {
  if (!nativeModuleRef) {
    logModuleUnavailable('consumePendingNotificationLaunchAction');
    return null;
  }

  log.debug('Consuming pending notification launch action');
  return parsePendingNotificationLaunchAction(
    await nativeModuleRef.consumePendingLaunchAction(),
  );
}

export async function saveNotificationDocument(document: NotificationDocument) {
  if (!nativeModuleRef) {
    logModuleUnavailable('saveNotificationDocument');
    return JSON.stringify(document);
  }

  log.debug('Saving notification document', {
    expiredIntervals: document.head.expiredIntervals.length,
    isRunning: document.head.timerState.isRunning,
    notificationsEnabled: document.head.timerConfig.notificationsEnabled,
  });
  return nativeModuleRef.saveDocument(JSON.stringify(document));
}

export async function syncNotificationDocument(document: NotificationDocument) {
  if (!nativeModuleRef) {
    logModuleUnavailable('syncNotificationDocument');
    return JSON.stringify(document);
  }

  log.debug('Syncing notification document', {
    expiredIntervals: document.head.expiredIntervals.length,
    isRunning: document.head.timerState.isRunning,
    notificationsEnabled: document.head.timerConfig.notificationsEnabled,
  });
  return nativeModuleRef.syncDocument(JSON.stringify(document));
}

export async function startNotificationTimer(document: NotificationDocument) {
  if (!nativeModuleRef) {
    logModuleUnavailable('startNotificationTimer');
    return JSON.stringify(document);
  }

  log.debug('Starting notification timer', {
    pausedRemainingMs: document.head.timerState.pausedRemainingMs,
  });
  return nativeModuleRef.startTimer(JSON.stringify(document));
}

export async function pauseNotificationTimer(document: NotificationDocument) {
  if (!nativeModuleRef) {
    logModuleUnavailable('pauseNotificationTimer');
    return JSON.stringify(document);
  }

  log.debug('Pausing notification timer', {
    pausedRemainingMs: document.head.timerState.pausedRemainingMs,
  });
  return nativeModuleRef.pauseTimer(JSON.stringify(document));
}

export async function resetNotificationTimer(document: NotificationDocument) {
  if (!nativeModuleRef) {
    logModuleUnavailable('resetNotificationTimer');
    return JSON.stringify(document);
  }

  log.debug('Resetting notification timer');
  return nativeModuleRef.resetTimer(JSON.stringify(document));
}

export async function getNotificationRuntimeStatus(): Promise<NotificationRuntimeStatus> {
  if (!nativeModuleRef) {
    logModuleUnavailable('getNotificationRuntimeStatus');
    return createDefaultNotificationRuntimeStatus();
  }

  log.debug('Refreshing notification runtime status');
  return parseRuntimeStatus(await nativeModuleRef.getRuntimeStatus());
}

export async function canScheduleExactAlarms() {
  if (!nativeModuleRef) {
    logModuleUnavailable('canScheduleExactAlarms');
    return false;
  }

  return nativeModuleRef.canScheduleExactAlarms();
}

export async function openExactAlarmSettings() {
  if (!nativeModuleRef) {
    logModuleUnavailable('openExactAlarmSettings');
    return;
  }

  log.info('Opening exact alarm settings');
  await nativeModuleRef.openExactAlarmSettings();
}

export async function openNotificationSettings() {
  if (!nativeModuleRef) {
    logModuleUnavailable('openNotificationSettings');
    return;
  }

  log.info('Opening app notification settings');
  await nativeModuleRef.openNotificationSettings();
}

export async function openPromotedNotificationSettings() {
  if (!nativeModuleRef) {
    logModuleUnavailable('openPromotedNotificationSettings');
    return;
  }

  log.info('Opening promoted notification settings');
  await nativeModuleRef.openPromotedNotificationSettings();
}

export async function openFullScreenIntentSettings() {
  if (!nativeModuleRef) {
    logModuleUnavailable('openFullScreenIntentSettings');
    return;
  }

  log.info('Opening full-screen intent settings');
  await nativeModuleRef.openFullScreenIntentSettings();
}

export async function stopExpiredAlarmPlayback() {
  if (!nativeModuleRef) {
    logModuleUnavailable('stopExpiredAlarmPlayback');
    return;
  }

  log.debug('Stopping expired alarm playback');
  await nativeModuleRef.stopExpiredAlarmPlayback();
}

export async function requestNotificationPermission() {
  if (Platform.OS !== 'android') {
    log.debug(
      'Skipping notification permission request on unsupported platform',
      {
        platform: Platform.OS,
      },
    );
    return true;
  }

  if (typeof Platform.Version !== 'number' || Platform.Version < 33) {
    log.debug(
      'Skipping runtime notification permission request on Android version',
      {
        version: Platform.Version,
      },
    );
    return true;
  }

  log.info('Requesting Android notification permission');
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  const granted = result === PermissionsAndroid.RESULTS.GRANTED;

  log.info('Android notification permission request completed', {
    granted,
    result,
  });

  return granted;
}

export function addNotificationStateChangeListener(
  onStateChanged: (event: {
    document: NotificationDocument;
    reason: string;
    runtimeStatus: NotificationRuntimeStatus;
  }) => void,
): EventSubscription | null {
  if (!nativeModuleRef) {
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNotificationsStateChanged',
    (event: NotificationStateChangedEvent | NotificationLaunchActionEvent) => {
      const stateEvent = event as NotificationStateChangedEvent;
      const document = parseNotificationDocument(stateEvent.documentJson);

      if (!document) {
        return;
      }

      onStateChanged({
        document,
        reason: stateEvent.reason,
        runtimeStatus: parseRuntimeStatus(stateEvent.runtimeStatusJson),
      });
    },
  );
}

export function addNotificationLaunchActionListener(
  onLaunchAction: (action: PendingNotificationLaunchAction) => void,
): EventSubscription | null {
  if (!nativeModuleRef) {
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNotificationsLaunchAction',
    (event: NotificationStateChangedEvent | NotificationLaunchActionEvent) => {
      const parsedAction = parsePendingNotificationLaunchAction(
        (event as NotificationLaunchActionEvent).actionJson,
      );

      if (parsedAction) {
        onLaunchAction(parsedAction);
      }
    },
  );
}

function parseRuntimeStatus(
  runtimeStatusJson: string,
): NotificationRuntimeStatus {
  const fallback = createDefaultNotificationRuntimeStatus();
  let parsedValue: Partial<NotificationRuntimeStatus>;

  try {
    parsedValue = JSON.parse(
      runtimeStatusJson,
    ) as Partial<NotificationRuntimeStatus>;
  } catch {
    log.warn('Failed to parse notification runtime status payload');
    return fallback;
  }

  return {
    countdownNotificationChannelImportance:
      parsedValue.countdownNotificationChannelImportance ??
      fallback.countdownNotificationChannelImportance,
    countdownNotificationHasPromotableCharacteristics:
      parsedValue.countdownNotificationHasPromotableCharacteristics ??
      fallback.countdownNotificationHasPromotableCharacteristics,
    countdownNotificationIsOngoing:
      parsedValue.countdownNotificationIsOngoing ??
      fallback.countdownNotificationIsOngoing,
    countdownNotificationRequestedPromoted:
      parsedValue.countdownNotificationRequestedPromoted ??
      fallback.countdownNotificationRequestedPromoted,
    countdownNotificationUsesChronometer:
      parsedValue.countdownNotificationUsesChronometer ??
      fallback.countdownNotificationUsesChronometer,
    countdownNotificationWhen:
      parsedValue.countdownNotificationWhen ??
      fallback.countdownNotificationWhen,
    exactAlarmPermissionGranted:
      parsedValue.exactAlarmPermissionGranted ??
      fallback.exactAlarmPermissionGranted,
    expiredNotificationCategory:
      parsedValue.expiredNotificationCategory ??
      fallback.expiredNotificationCategory,
    expiredNotificationChannelImportance:
      parsedValue.expiredNotificationChannelImportance ??
      fallback.expiredNotificationChannelImportance,
    expiredNotificationHasCustomHeadsUp:
      parsedValue.expiredNotificationHasCustomHeadsUp ??
      fallback.expiredNotificationHasCustomHeadsUp,
    expiredNotificationHasFullScreenIntent:
      parsedValue.expiredNotificationHasFullScreenIntent ??
      fallback.expiredNotificationHasFullScreenIntent,
    fullScreenIntentPermissionGranted:
      parsedValue.fullScreenIntentPermissionGranted ??
      fallback.fullScreenIntentPermissionGranted,
    fullScreenIntentSettingsResolvable:
      parsedValue.fullScreenIntentSettingsResolvable ??
      fallback.fullScreenIntentSettingsResolvable,
    isAppInForeground:
      parsedValue.isAppInForeground ?? fallback.isAppInForeground,
    isRunning: parsedValue.isRunning ?? fallback.isRunning,
    lastTriggeredAt: parsedValue.lastTriggeredAt ?? fallback.lastTriggeredAt,
    nextTriggerAt: parsedValue.nextTriggerAt ?? fallback.nextTriggerAt,
    notificationPermissionGranted:
      parsedValue.notificationPermissionGranted ??
      fallback.notificationPermissionGranted,
    promotedNotificationSettingsResolvable:
      parsedValue.promotedNotificationSettingsResolvable ??
      fallback.promotedNotificationSettingsResolvable,
    promotedNotificationPermissionGranted:
      parsedValue.promotedNotificationPermissionGranted ??
      fallback.promotedNotificationPermissionGranted,
    sessionId: parsedValue.sessionId ?? fallback.sessionId,
  };
}

function parsePendingNotificationLaunchAction(
  actionJson: string | null,
): PendingNotificationLaunchAction | null {
  if (!actionJson) {
    return null;
  }

  let parsedValue: Partial<PendingNotificationLaunchAction>;

  try {
    parsedValue = JSON.parse(
      actionJson,
    ) as Partial<PendingNotificationLaunchAction>;
  } catch {
    log.warn('Failed to parse pending notification launch action payload');
    return null;
  }

  if (parsedValue.type !== 'check-in') {
    log.warn('Ignored unsupported notification launch action', {
      type: parsedValue.type ?? null,
    });
    return null;
  }

  return {
    intervalId: parsedValue.intervalId ?? null,
    notificationId: parsedValue.notificationId ?? null,
    sessionId: parsedValue.sessionId ?? null,
    triggeredAt: parsedValue.triggeredAt ?? null,
    type: 'check-in',
  };
}
