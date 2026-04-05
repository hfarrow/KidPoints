import {
  type EventSubscription,
  type NativeModule,
  requireOptionalNativeModule,
} from 'expo-modules-core';

import type { PersistedAppDocument } from './transactions';

export type AlarmEngineRuntimeStatus = {
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

export type PendingAlarmLaunchAction = {
  intervalId: string | null;
  notificationId: number | null;
  sessionId: string | null;
  triggeredAt: number | null;
  type: 'check-in';
};

type AlarmEngineStateChangedEvent = {
  documentJson: string;
  reason: string;
  runtimeStatusJson: string;
};

type AlarmEngineLaunchActionEvent = {
  actionJson: string;
};

type AlarmEngineModule = NativeModule<{
  KidPointsAlarmLaunchAction: (event: AlarmEngineLaunchActionEvent) => void;
  KidPointsAlarmStateChanged: (event: AlarmEngineStateChangedEvent) => void;
}> & {
  addListener: (
    eventName: 'KidPointsAlarmStateChanged' | 'KidPointsAlarmLaunchAction',
    listener:
      | ((event: AlarmEngineStateChangedEvent) => void)
      | ((event: AlarmEngineLaunchActionEvent) => void),
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

const moduleRef =
  requireOptionalNativeModule<AlarmEngineModule>('KidPointsAlarm');

export function isAlarmEngineAvailable() {
  return !!moduleRef;
}

export async function loadPersistedDocument() {
  return moduleRef?.getDocument() ?? null;
}

export async function getPendingAlarmLaunchAction() {
  if (!moduleRef) {
    return null;
  }

  return parsePendingLaunchAction(await moduleRef.getPendingLaunchAction());
}

export async function consumePendingAlarmLaunchAction() {
  if (!moduleRef) {
    return null;
  }

  return parsePendingLaunchAction(await moduleRef.consumePendingLaunchAction());
}

export async function savePersistedDocument(document: PersistedAppDocument) {
  if (!moduleRef) {
    return JSON.stringify(document);
  }

  return moduleRef.saveDocument(JSON.stringify(document));
}

export async function syncAlarmDocument(document: PersistedAppDocument) {
  if (!moduleRef) {
    return JSON.stringify(document);
  }

  return moduleRef.syncDocument(JSON.stringify(document));
}

export async function startAlarmTimer(document: PersistedAppDocument) {
  if (!moduleRef) {
    return JSON.stringify(document);
  }

  return moduleRef.startTimer(JSON.stringify(document));
}

export async function resetAlarmTimer(document: PersistedAppDocument) {
  if (!moduleRef) {
    return JSON.stringify(document);
  }

  return moduleRef.resetTimer(JSON.stringify(document));
}

export async function pauseAlarmTimer(document: PersistedAppDocument) {
  if (!moduleRef) {
    return JSON.stringify(document);
  }

  return moduleRef.pauseTimer(JSON.stringify(document));
}

export async function getAlarmRuntimeStatus(): Promise<AlarmEngineRuntimeStatus> {
  if (!moduleRef) {
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

  return parseRuntimeStatus(await moduleRef.getRuntimeStatus());
}

export async function canScheduleExactAlarms() {
  if (!moduleRef) {
    return false;
  }

  return moduleRef.canScheduleExactAlarms();
}

export async function openExactAlarmSettings() {
  if (!moduleRef) {
    return;
  }

  await moduleRef.openExactAlarmSettings();
}

export async function openNotificationSettings() {
  if (!moduleRef) {
    return;
  }

  await moduleRef.openNotificationSettings();
}

export async function openFullScreenIntentSettings() {
  if (!moduleRef) {
    return;
  }

  await moduleRef.openFullScreenIntentSettings();
}

export async function openPromotedNotificationSettings() {
  if (!moduleRef) {
    return;
  }

  await moduleRef.openPromotedNotificationSettings();
}

export async function stopExpiredAlarmPlayback() {
  if (!moduleRef) {
    return;
  }

  await moduleRef.stopExpiredAlarmPlayback();
}

export function addAlarmEngineListener(
  onStateChanged: (event: {
    document: PersistedAppDocument;
    reason: string;
    runtimeStatus: AlarmEngineRuntimeStatus;
  }) => void,
): EventSubscription | null {
  if (!moduleRef) {
    return null;
  }

  return moduleRef.addListener(
    'KidPointsAlarmStateChanged',
    (event: AlarmEngineStateChangedEvent | AlarmEngineLaunchActionEvent) => {
      const stateEvent = event as AlarmEngineStateChangedEvent;

      onStateChanged({
        document: JSON.parse(stateEvent.documentJson) as PersistedAppDocument,
        reason: stateEvent.reason,
        runtimeStatus: parseRuntimeStatus(stateEvent.runtimeStatusJson),
      });
    },
  );
}

export function addAlarmLaunchActionListener(
  onLaunchAction: (action: PendingAlarmLaunchAction) => void,
): EventSubscription | null {
  if (!moduleRef) {
    return null;
  }

  return moduleRef.addListener(
    'KidPointsAlarmLaunchAction',
    (event: AlarmEngineStateChangedEvent | AlarmEngineLaunchActionEvent) => {
      const launchAction = parsePendingLaunchAction(
        (event as AlarmEngineLaunchActionEvent).actionJson,
      );

      if (launchAction) {
        onLaunchAction(launchAction);
      }
    },
  );
}

function parseRuntimeStatus(
  runtimeStatusJson: string,
): AlarmEngineRuntimeStatus {
  const parsedValue = JSON.parse(
    runtimeStatusJson,
  ) as Partial<AlarmEngineRuntimeStatus>;

  return {
    countdownNotificationChannelImportance:
      parsedValue.countdownNotificationChannelImportance ?? null,
    countdownNotificationHasPromotableCharacteristics:
      parsedValue.countdownNotificationHasPromotableCharacteristics ?? false,
    countdownNotificationIsOngoing:
      parsedValue.countdownNotificationIsOngoing ?? false,
    countdownNotificationRequestedPromoted:
      parsedValue.countdownNotificationRequestedPromoted ?? false,
    countdownNotificationUsesChronometer:
      parsedValue.countdownNotificationUsesChronometer ?? false,
    countdownNotificationWhen: parsedValue.countdownNotificationWhen ?? null,
    exactAlarmPermissionGranted:
      parsedValue.exactAlarmPermissionGranted ?? false,
    expiredNotificationCategory:
      parsedValue.expiredNotificationCategory ?? null,
    expiredNotificationChannelImportance:
      parsedValue.expiredNotificationChannelImportance ?? null,
    expiredNotificationHasCustomHeadsUp:
      parsedValue.expiredNotificationHasCustomHeadsUp ?? false,
    expiredNotificationHasFullScreenIntent:
      parsedValue.expiredNotificationHasFullScreenIntent ?? false,
    fullScreenIntentPermissionGranted:
      parsedValue.fullScreenIntentPermissionGranted ?? false,
    fullScreenIntentSettingsResolvable:
      parsedValue.fullScreenIntentSettingsResolvable ?? false,
    isAppInForeground: parsedValue.isAppInForeground ?? false,
    isRunning: parsedValue.isRunning ?? false,
    lastTriggeredAt: parsedValue.lastTriggeredAt ?? null,
    nextTriggerAt: parsedValue.nextTriggerAt ?? null,
    notificationPermissionGranted:
      parsedValue.notificationPermissionGranted ?? false,
    promotedNotificationSettingsResolvable:
      parsedValue.promotedNotificationSettingsResolvable ?? false,
    promotedNotificationPermissionGranted:
      parsedValue.promotedNotificationPermissionGranted ?? false,
    sessionId: parsedValue.sessionId ?? null,
  };
}

function parsePendingLaunchAction(
  actionJson: string | null,
): PendingAlarmLaunchAction | null {
  if (!actionJson) {
    return null;
  }

  const parsedValue = JSON.parse(
    actionJson,
  ) as Partial<PendingAlarmLaunchAction>;

  if (parsedValue.type !== 'check-in') {
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
