import {
  type EventSubscription,
  type NativeModule,
  requireOptionalNativeModule,
} from 'expo-modules-core';
import { type Permission, PermissionsAndroid, Platform } from 'react-native';
import { createModuleLogger } from '../../logging/logger';
import {
  type NativeLogEntry,
  parseBufferedNativeLogEntries,
  parseNativeLogEntry as parseSharedNativeLogEntry,
} from '../../logging/nativeLogSync';

export type NearbySyncAvailability = {
  isReady: boolean;
  isSupported: boolean;
  playServicesStatus: number | null;
  reason:
    | 'module-unavailable'
    | 'play-services-error'
    | 'play-services-missing'
    | 'ready';
};

export type NearbySyncPermissionStatus = {
  allGranted: boolean;
  requiredPermissions: string[];
  results: Record<string, string>;
};

export type NearbySyncEndpoint = {
  endpointId: string;
  endpointName: string;
};

export type NearbySyncConnectionRequestedEvent = {
  endpointId: string;
  endpointName: string;
};

export type NearbySyncAuthTokenEvent = {
  authToken: string;
  endpointId: string;
  endpointName: string;
  isIncomingConnection: boolean;
};

export type NearbySyncConnectionStateEvent = {
  endpointId: string;
  endpointName: string;
  reason: string | null;
  state: 'connected' | 'connecting' | 'disconnected' | 'rejected' | 'requested';
};

export type NearbySyncPayloadProgressEvent = {
  bytesTransferred: number | null;
  endpointId: string;
  fileUri: string | null;
  payloadId: number;
  payloadKind: 'bytes' | 'file' | 'stream';
  status: 'canceled' | 'failure' | 'in-progress' | 'success';
  totalBytes: number | null;
};

export type NearbySyncEnvelopeReceivedEvent = {
  endpointId: string;
  envelopeJson: string;
  payloadId: number;
};

export type NearbySyncErrorEvent = {
  code: string;
  message: string;
};

type NearbySyncDiscoveryUpdatedEvent = {
  endpoints: NearbySyncEndpoint[];
};

type NearbySyncAvailabilityChangedEvent = NearbySyncAvailability;

type NearbySyncNativeLogEvent = NativeLogEntry;

export type NearbySyncNativeLogEntry = NativeLogEntry;

const log = createModuleLogger('nearby-sync-bridge');

type NearbySyncNativeModule = NativeModule<{
  KidPointsNearbySyncAuthTokenReady: (event: NearbySyncAuthTokenEvent) => void;
  KidPointsNearbySyncAvailabilityChanged: (
    event: NearbySyncAvailabilityChangedEvent,
  ) => void;
  KidPointsNearbySyncConnectionRequested: (
    event: NearbySyncConnectionRequestedEvent,
  ) => void;
  KidPointsNearbySyncConnectionStateChanged: (
    event: NearbySyncConnectionStateEvent,
  ) => void;
  KidPointsNearbySyncDiscoveryUpdated: (
    event: NearbySyncDiscoveryUpdatedEvent,
  ) => void;
  KidPointsNearbySyncEnvelopeReceived: (
    event: NearbySyncEnvelopeReceivedEvent,
  ) => void;
  KidPointsNearbySyncError: (event: NearbySyncErrorEvent) => void;
  KidPointsNearbySyncLog: (event: NearbySyncNativeLogEvent) => void;
  KidPointsNearbySyncPayloadProgress: (
    event: NearbySyncPayloadProgressEvent,
  ) => void;
}> & {
  acceptConnection: (endpointId: string) => Promise<void>;
  addListener: (
    eventName:
      | 'KidPointsNearbySyncAuthTokenReady'
      | 'KidPointsNearbySyncAvailabilityChanged'
      | 'KidPointsNearbySyncConnectionRequested'
      | 'KidPointsNearbySyncConnectionStateChanged'
      | 'KidPointsNearbySyncDiscoveryUpdated'
      | 'KidPointsNearbySyncEnvelopeReceived'
      | 'KidPointsNearbySyncError'
      | 'KidPointsNearbySyncLog'
      | 'KidPointsNearbySyncPayloadProgress',
    listener: (event: unknown) => void,
  ) => EventSubscription;
  disconnect: (endpointId: string | null) => Promise<void>;
  getAvailabilityStatus: () => Promise<NearbySyncAvailabilityChangedEvent>;
  getBufferedLogs: (afterSequence: number) => string;
  rejectConnection: (endpointId: string) => Promise<void>;
  requestConnection: (endpointId: string) => Promise<void>;
  sendEnvelope: (endpointId: string, envelopeJson: string) => Promise<number>;
  sendFile: (endpointId: string, fileUri: string) => Promise<number>;
  startDiscovery: (localEndpointName: string) => Promise<void>;
  startHosting: (
    sessionLabel: string,
    localEndpointName: string,
  ) => Promise<void>;
  stopAll: () => Promise<void>;
};

const nativeModuleRef = requireOptionalNativeModule<NearbySyncNativeModule>(
  'KidPointsNearbySync',
);

function logModuleUnavailable(method: string) {
  log.debug('Nearby sync bridge unavailable; using fallback', { method });
}

function getRequiredNearbyPermissions(): Permission[] {
  if (Platform.OS !== 'android') {
    return [];
  }

  const version =
    typeof Platform.Version === 'number' ? Platform.Version : Number.NaN;

  if (!Number.isFinite(version)) {
    return [];
  }

  if (version >= 33) {
    return [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
    ];
  }

  if (version >= 31) {
    return [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ];
  }

  return [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
}

function createUnavailableAvailability(): NearbySyncAvailability {
  return {
    isReady: false,
    isSupported: false,
    playServicesStatus: null,
    reason: 'module-unavailable',
  };
}

export function isNearbySyncModuleAvailable() {
  return Boolean(nativeModuleRef);
}

export async function isAvailable(): Promise<NearbySyncAvailability> {
  if (!nativeModuleRef) {
    logModuleUnavailable('isAvailable');
    return createUnavailableAvailability();
  }

  const availability = await nativeModuleRef.getAvailabilityStatus();

  log.debug('Nearby sync availability refreshed', availability);

  return availability;
}

export async function requestPermissions(): Promise<NearbySyncPermissionStatus> {
  const requiredPermissions = getRequiredNearbyPermissions();

  if (Platform.OS !== 'android' || requiredPermissions.length === 0) {
    return {
      allGranted: true,
      requiredPermissions,
      results: {},
    };
  }

  log.info('Requesting nearby sync permissions', {
    permissionCount: requiredPermissions.length,
  });
  const results = (await PermissionsAndroid.requestMultiple(
    requiredPermissions,
  )) as Record<string, string>;
  const normalizedResults = Object.fromEntries(
    requiredPermissions.map((permission) => [
      permission,
      results[permission] ?? 'unavailable',
    ]),
  );
  const allGranted = requiredPermissions.every(
    (permission) =>
      normalizedResults[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );

  log.info('Nearby sync permissions request completed', {
    allGranted,
    requiredPermissions,
  });

  return {
    allGranted,
    requiredPermissions,
    results: normalizedResults,
  };
}

export async function startHosting(args: {
  localEndpointName: string;
  sessionLabel: string;
}) {
  if (!nativeModuleRef) {
    logModuleUnavailable('startHosting');
    return;
  }

  log.info('Starting nearby sync hosting', {
    localEndpointName: args.localEndpointName,
    sessionLabel: args.sessionLabel,
  });
  await nativeModuleRef.startHosting(args.sessionLabel, args.localEndpointName);
}

export async function startDiscovery(args: { localEndpointName: string }) {
  if (!nativeModuleRef) {
    logModuleUnavailable('startDiscovery');
    return;
  }

  log.info('Starting nearby sync discovery', {
    localEndpointName: args.localEndpointName,
  });
  await nativeModuleRef.startDiscovery(args.localEndpointName);
}

export async function requestConnection(endpointId: string) {
  if (!nativeModuleRef) {
    logModuleUnavailable('requestConnection');
    return;
  }

  log.info('Requesting nearby sync connection', { endpointId });
  await nativeModuleRef.requestConnection(endpointId);
}

export async function acceptConnection(endpointId: string) {
  if (!nativeModuleRef) {
    logModuleUnavailable('acceptConnection');
    return;
  }

  log.info('Accepting nearby sync connection', { endpointId });
  await nativeModuleRef.acceptConnection(endpointId);
}

export async function rejectConnection(endpointId: string) {
  if (!nativeModuleRef) {
    logModuleUnavailable('rejectConnection');
    return;
  }

  log.info('Rejecting nearby sync connection', { endpointId });
  await nativeModuleRef.rejectConnection(endpointId);
}

export async function sendEnvelope(args: {
  endpointId: string;
  envelopeJson: string;
}) {
  if (!nativeModuleRef) {
    logModuleUnavailable('sendEnvelope');
    return -1;
  }

  log.debug('Sending nearby sync envelope', {
    endpointId: args.endpointId,
  });
  return nativeModuleRef.sendEnvelope(args.endpointId, args.envelopeJson);
}

export async function sendFile(args: { endpointId: string; fileUri: string }) {
  if (!nativeModuleRef) {
    logModuleUnavailable('sendFile');
    return -1;
  }

  log.info('Sending nearby sync file payload', {
    endpointId: args.endpointId,
    fileUri: args.fileUri,
  });
  return nativeModuleRef.sendFile(args.endpointId, args.fileUri);
}

export async function disconnect(endpointId: string | null = null) {
  if (!nativeModuleRef) {
    logModuleUnavailable('disconnect');
    return;
  }

  log.info('Disconnecting nearby sync endpoint', { endpointId });
  await nativeModuleRef.disconnect(endpointId);
}

export async function stopAll() {
  if (!nativeModuleRef) {
    logModuleUnavailable('stopAll');
    return;
  }

  log.info('Stopping all nearby sync activity');
  await nativeModuleRef.stopAll();
}

export function getBufferedNearbySyncLogs(afterSequence = -1) {
  if (!nativeModuleRef) {
    logModuleUnavailable('getBufferedNearbySyncLogs');
    return [] as NearbySyncNativeLogEntry[];
  }

  return parseBufferedNativeLogEntries({
    logEntriesJson: nativeModuleRef.getBufferedLogs(afterSequence),
    logger: log,
    sourceLabel: 'nearby sync buffered native logs',
  });
}

function parseNativeLogEntry(value: unknown): NearbySyncNativeLogEntry | null {
  return parseSharedNativeLogEntry(value);
}

export function addAvailabilityChangeListener(
  listener: (event: NearbySyncAvailability) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addAvailabilityChangeListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNearbySyncAvailabilityChanged',
    (event: unknown) => {
      listener(
        (event ?? createUnavailableAvailability()) as NearbySyncAvailability,
      );
    },
  );
}

export function addDiscoveryUpdatedListener(
  listener: (event: NearbySyncDiscoveryUpdatedEvent) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addDiscoveryUpdatedListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNearbySyncDiscoveryUpdated',
    (event: unknown) => {
      listener((event ?? { endpoints: [] }) as NearbySyncDiscoveryUpdatedEvent);
    },
  );
}

export function addConnectionRequestedListener(
  listener: (event: NearbySyncConnectionRequestedEvent) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addConnectionRequestedListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNearbySyncConnectionRequested',
    (event: unknown) => {
      listener(event as NearbySyncConnectionRequestedEvent);
    },
  );
}

export function addAuthTokenReadyListener(
  listener: (event: NearbySyncAuthTokenEvent) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addAuthTokenReadyListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNearbySyncAuthTokenReady',
    (event: unknown) => {
      listener(event as NearbySyncAuthTokenEvent);
    },
  );
}

export function addConnectionStateChangedListener(
  listener: (event: NearbySyncConnectionStateEvent) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addConnectionStateChangedListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNearbySyncConnectionStateChanged',
    (event: unknown) => {
      listener(event as NearbySyncConnectionStateEvent);
    },
  );
}

export function addPayloadProgressListener(
  listener: (event: NearbySyncPayloadProgressEvent) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addPayloadProgressListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNearbySyncPayloadProgress',
    (event: unknown) => {
      listener(event as NearbySyncPayloadProgressEvent);
    },
  );
}

export function addEnvelopeReceivedListener(
  listener: (event: NearbySyncEnvelopeReceivedEvent) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addEnvelopeReceivedListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNearbySyncEnvelopeReceived',
    (event: unknown) => {
      listener(event as NearbySyncEnvelopeReceivedEvent);
    },
  );
}

export function addErrorListener(
  listener: (event: NearbySyncErrorEvent) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addErrorListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNearbySyncError',
    (event: unknown) => {
      listener(event as NearbySyncErrorEvent);
    },
  );
}

export function addNearbySyncLogListener(
  listener: (entry: NearbySyncNativeLogEntry) => void,
) {
  if (!nativeModuleRef) {
    logModuleUnavailable('addNearbySyncLogListener');
    return null;
  }

  return nativeModuleRef.addListener(
    'KidPointsNearbySyncLog',
    (event: unknown) => {
      const entry = parseNativeLogEntry(event);

      if (entry) {
        listener(entry);
      }
    },
  );
}
