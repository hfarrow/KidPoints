import {
  type EventSubscription,
  type NativeModule,
  requireOptionalNativeModule,
} from 'expo-modules-core';
import { Platform } from 'react-native';
import { createModuleLogger } from '../../logging/logger';
import {
  type NativeLogEntry,
  parseBufferedNativeLogEntries,
  parseNativeLogEntry as parseSharedNativeLogEntry,
} from '../../logging/nativeLogSync';

export type NfcBootstrapAvailability = {
  hasAdapter: boolean;
  isEnabled: boolean;
  isReady: boolean;
  reason:
    | 'activity-unavailable'
    | 'hce-unsupported'
    | 'module-unavailable'
    | 'nfc-disabled'
    | 'nfc-unavailable'
    | 'reader-mode-unsupported'
    | 'ready';
  supportsHce: boolean;
  supportsReaderMode: boolean;
};

export type NfcBootstrapRole = 'host' | 'join' | null;

export type NfcBootstrapStateChangedEvent = {
  attemptId: string | null;
  failureReason: string | null;
  message: string;
  phase:
    | 'completed'
    | 'error'
    | 'hce-active'
    | 'idle'
    | 'reader-active'
    | 'starting'
    | 'waiting-for-activity';
  role: NfcBootstrapRole;
};

export type NfcBootstrapCompletedEvent = {
  attemptId: string;
  bootstrapToken: string;
  peerDeviceHash: string;
  role: Exclude<NfcBootstrapRole, null>;
};

type NfcSyncNativeLogEvent = NativeLogEntry;

export type NfcSyncNativeLogEntry = NativeLogEntry;

type NfcSyncNativeModule = NativeModule<{
  KidPointsNfcSyncBootstrapCompleted: (
    event: NfcBootstrapCompletedEvent,
  ) => void;
  KidPointsNfcSyncBootstrapStateChanged: (
    event: NfcBootstrapStateChangedEvent,
  ) => void;
  KidPointsNfcSyncLog: (event: NfcSyncNativeLogEvent) => void;
}> & {
  addListener: (
    eventName:
      | 'KidPointsNfcSyncBootstrapCompleted'
      | 'KidPointsNfcSyncBootstrapStateChanged'
      | 'KidPointsNfcSyncLog',
    listener: (event: unknown) => void,
  ) => EventSubscription;
  beginBootstrap: (localDeviceId: string, timeoutMs: number) => Promise<void>;
  cancelBootstrap: () => Promise<void>;
  getAvailabilityStatus: () => Promise<NfcBootstrapAvailability>;
  getBufferedLogs: (afterSequence: number) => string;
};

const log = createModuleLogger('nfc-sync-bridge');
const nativeModuleRef =
  requireOptionalNativeModule<NfcSyncNativeModule>('KidPointsNfcSync');

function logModuleUnavailable(method: string) {
  log.debug('NFC sync bridge unavailable; using fallback', { method });
}

function createUnavailableAvailability(
  reason: NfcBootstrapAvailability['reason'] = 'module-unavailable',
): NfcBootstrapAvailability {
  return {
    hasAdapter: false,
    isEnabled: false,
    isReady: false,
    reason,
    supportsHce: false,
    supportsReaderMode: false,
  };
}

export function isNfcSyncModuleAvailable() {
  return Boolean(nativeModuleRef);
}

export async function getNfcBootstrapAvailability(): Promise<NfcBootstrapAvailability> {
  if (Platform.OS !== 'android') {
    return createUnavailableAvailability('module-unavailable');
  }

  if (!nativeModuleRef) {
    logModuleUnavailable('getNfcBootstrapAvailability');
    return createUnavailableAvailability();
  }

  const availability = await nativeModuleRef.getAvailabilityStatus();

  log.debug('NFC bootstrap availability refreshed', availability);

  return availability;
}

export async function beginNfcBootstrap(args: {
  localDeviceId: string;
  timeoutMs: number;
}) {
  if (!nativeModuleRef) {
    logModuleUnavailable('beginNfcBootstrap');
    return;
  }

  log.info('Starting NFC bootstrap', {
    localDeviceIdSuffix: args.localDeviceId.slice(-4),
    timeoutMs: args.timeoutMs,
  });
  await nativeModuleRef.beginBootstrap(args.localDeviceId, args.timeoutMs);
}

export async function cancelNfcBootstrap() {
  if (!nativeModuleRef) {
    logModuleUnavailable('cancelNfcBootstrap');
    return;
  }

  log.info('Canceling NFC bootstrap');
  await nativeModuleRef.cancelBootstrap();
}

export function getBufferedNfcSyncLogs(afterSequence = -1) {
  if (!nativeModuleRef) {
    logModuleUnavailable('getBufferedNfcSyncLogs');
    return [] as NfcSyncNativeLogEntry[];
  }

  return parseBufferedNativeLogEntries({
    logEntriesJson: nativeModuleRef.getBufferedLogs(afterSequence),
    logger: log,
    sourceLabel: 'nfc sync buffered native logs',
  });
}

function parseNativeLogEntry(value: unknown): NfcSyncNativeLogEntry | null {
  return parseSharedNativeLogEntry(value);
}

export function addNfcBootstrapStateChangedListener(
  listener: (event: NfcBootstrapStateChangedEvent) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addNfcBootstrapStateChangedListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNfcSyncBootstrapStateChanged',
    (event: unknown) => {
      listener(event as NfcBootstrapStateChangedEvent);
    },
  );
}

export function addNfcBootstrapCompletedListener(
  listener: (event: NfcBootstrapCompletedEvent) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addNfcBootstrapCompletedListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNfcSyncBootstrapCompleted',
    (event: unknown) => {
      listener(event as NfcBootstrapCompletedEvent);
    },
  );
}

export function addNfcSyncLogListener(
  listener: (entry: NfcSyncNativeLogEntry) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addNfcSyncLogListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNfcSyncLog',
    (event: unknown) => {
      const entry = parseNativeLogEntry(event);

      if (entry) {
        listener(entry);
      }
    },
  );
}
