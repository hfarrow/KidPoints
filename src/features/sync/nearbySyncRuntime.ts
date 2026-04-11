import {
  acceptConnection,
  addAuthTokenReadyListener,
  addAvailabilityChangeListener,
  addConnectionRequestedListener,
  addConnectionStateChangedListener,
  addDiscoveryUpdatedListener,
  addEnvelopeReceivedListener,
  addErrorListener,
  addNearbySyncLogListener,
  addPayloadProgressListener,
  disconnect,
  getBufferedNearbySyncLogs,
  isAvailable,
  type NearbySyncAuthTokenEvent,
  type NearbySyncAvailability,
  type NearbySyncConnectionRequestedEvent,
  type NearbySyncConnectionStateEvent,
  type NearbySyncEndpoint,
  type NearbySyncEnvelopeReceivedEvent,
  type NearbySyncErrorEvent,
  type NearbySyncNativeLogEntry,
  type NearbySyncPayloadProgressEvent,
  type NearbySyncPermissionStatus,
  rejectConnection,
  requestConnection,
  requestPermissions,
  sendEnvelope,
  sendFile,
  startDiscovery,
  startHosting,
  stopAll,
} from './nearbySyncBridge';

export type SyncRuntimeSubscription = {
  remove: () => void;
};

export type NearbySyncRuntime = {
  acceptConnection: (endpointId: string) => Promise<void>;
  addAuthTokenReadyListener: (
    listener: (event: NearbySyncAuthTokenEvent) => void,
  ) => SyncRuntimeSubscription | null;
  addAvailabilityChangeListener: (
    listener: (event: NearbySyncAvailability) => void,
  ) => SyncRuntimeSubscription | null;
  addConnectionRequestedListener: (
    listener: (event: NearbySyncConnectionRequestedEvent) => void,
  ) => SyncRuntimeSubscription | null;
  addConnectionStateChangedListener: (
    listener: (event: NearbySyncConnectionStateEvent) => void,
  ) => SyncRuntimeSubscription | null;
  addDiscoveryUpdatedListener: (
    listener: (event: { endpoints: NearbySyncEndpoint[] }) => void,
  ) => SyncRuntimeSubscription | null;
  addEnvelopeReceivedListener: (
    listener: (event: NearbySyncEnvelopeReceivedEvent) => void,
  ) => SyncRuntimeSubscription | null;
  addErrorListener: (
    listener: (event: NearbySyncErrorEvent) => void,
  ) => SyncRuntimeSubscription | null;
  addNearbySyncLogListener: (
    listener: (entry: NearbySyncNativeLogEntry) => void,
  ) => SyncRuntimeSubscription | null;
  addPayloadProgressListener: (
    listener: (event: NearbySyncPayloadProgressEvent) => void,
  ) => SyncRuntimeSubscription | null;
  disconnect: (endpointId?: string | null) => Promise<void>;
  getBufferedNearbySyncLogs: (
    afterSequence?: number,
  ) => NearbySyncNativeLogEntry[];
  isAvailable: () => Promise<NearbySyncAvailability>;
  requestConnection: (endpointId: string) => Promise<void>;
  rejectConnection: (endpointId: string) => Promise<void>;
  requestPermissions: () => Promise<NearbySyncPermissionStatus>;
  sendEnvelope: (args: {
    endpointId: string;
    envelopeJson: string;
  }) => Promise<string>;
  sendFile: (args: { endpointId: string; fileUri: string }) => Promise<string>;
  startDiscovery: (args: { localEndpointName: string }) => Promise<void>;
  startHosting: (args: {
    localEndpointName: string;
    sessionLabel: string;
  }) => Promise<void>;
  stopAll: () => Promise<void>;
};

export function createNativeNearbySyncRuntime(): NearbySyncRuntime {
  return {
    acceptConnection,
    addAuthTokenReadyListener,
    addAvailabilityChangeListener,
    addConnectionRequestedListener,
    addConnectionStateChangedListener,
    addDiscoveryUpdatedListener,
    addEnvelopeReceivedListener,
    addErrorListener,
    addNearbySyncLogListener,
    addPayloadProgressListener,
    disconnect,
    getBufferedNearbySyncLogs,
    isAvailable,
    requestConnection,
    rejectConnection,
    requestPermissions,
    sendEnvelope,
    sendFile,
    startDiscovery,
    startHosting,
    stopAll,
  };
}
