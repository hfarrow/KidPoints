import { File, Paths } from 'expo-file-system';
import type { StateStorage } from 'zustand/middleware';
import {
  type PrepareSyncDeviceBundleResult,
  prepareSyncDeviceBundle,
} from '../../state/sharedSync';
import type { SharedDocument } from '../../state/sharedTypes';
import type {
  NearbySyncAuthTokenEvent,
  NearbySyncAvailability,
  NearbySyncConnectionRequestedEvent,
  NearbySyncConnectionStateEvent,
  NearbySyncEndpoint,
  NearbySyncEnvelopeReceivedEvent,
  NearbySyncErrorEvent,
  NearbySyncNativeLogEntry,
  NearbySyncPayloadProgressEvent,
  NearbySyncPermissionStatus,
} from './nearbySyncBridge';
import type {
  NearbySyncRuntime,
  SyncRuntimeSubscription,
} from './nearbySyncRuntime';
import type {
  NfcBootstrapAvailability,
  NfcBootstrapCompletedEvent,
  NfcBootstrapStateChangedEvent,
  NfcSyncNativeLogEntry,
} from './nfcSyncBridge';
import { exportSyncProjectionToFile } from './syncFileTransfer';
import {
  createBootstrapBoundSessionId,
  createBootstrapSessionLabel,
  createCommitAckEnvelope,
  createHelloEnvelope,
  createHistoryFileMetaEnvelope,
  createMergeResultEnvelope,
  createPrepareAckEnvelope,
  createSummaryEnvelope,
  createSyncResponseEnvelope,
  parseSyncEnvelope,
  serializeSyncEnvelope,
} from './syncProtocol';
import {
  createSyncTestbedRemoteProjection,
  type SyncTestbedFixtureStrategyId,
} from './syncTestbedFixtures';

export type SyncTestbedScenarioId =
  | 'availability-unavailable'
  | 'bundle-hash-mismatch'
  | 'commit-ack-bundle-mismatch'
  | 'connection-rejected'
  | 'disconnect-during-transfer'
  | 'happy-path-review'
  | 'happy-path-success'
  | 'merged-head-mismatch'
  | 'nfc-bootstrap-timeout'
  | 'nfc-unsupported'
  | 'payload-transfer-failed'
  | 'permissions-denied'
  | 'sync-response-rejected'
  | 'unreadable-remote-projection'
  | 'wrong-peer-bootstrap-token';

type SyncSimulatorSnapshot = {
  authToken: string;
  availability: NearbySyncAvailability;
  commonBaseTransactionId: string | null;
  fixtureStrategyId: SyncTestbedFixtureStrategyId;
  nfcAvailability: NfcBootstrapAvailability;
  permissions: NearbySyncPermissionStatus;
  remoteEndpoint: NearbySyncEndpoint;
  scenarioId: SyncTestbedScenarioId | null;
};

export type SyncSimulatorController = {
  applyScenario: (scenarioId: SyncTestbedScenarioId | null) => void;
  emitConnectionRequested: () => void;
  emitDiscoveryUpdated: () => void;
  emitDisconnect: (reason?: string | null) => void;
  emitRemoteCommit: () => void;
  emitRemoteCommitAck: (args?: {
    applied?: boolean;
    bundleHash?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }) => void;
  emitRemoteError: (code: string, message: string) => void;
  emitRemoteHello: () => void;
  emitRemoteHistoryTransfer: (args?: {
    invalidFile?: boolean;
    reverseDeliveryOrder?: boolean;
  }) => void;
  emitRemoteMergeResult: (args?: {
    bundleHashOverride?: string | null;
    mergedHeadSyncHashOverride?: string | null;
  }) => void;
  emitRemotePrepareAck: () => void;
  emitRemoteSummary: () => void;
  emitRemoteSyncResponse: (args?: {
    accepted?: boolean;
    reason?: string | null;
  }) => void;
  getDefaultRemoteEndpoint: () => NearbySyncEndpoint;
  getSnapshot: () => SyncSimulatorSnapshot;
  reset: () => void;
  setCommonBaseTransactionId: (transactionId: string | null) => void;
  setFixtureStrategy: (strategyId: SyncTestbedFixtureStrategyId) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createSimulatorNearbySyncRuntime(args: {
  initialCommonBaseTransactionId?: string | null;
  initialFixtureStrategyId?: SyncTestbedFixtureStrategyId;
  getLocalDocument: () => SharedDocument;
}): {
  controller: SyncSimulatorController;
  runtime: NearbySyncRuntime;
} {
  const controllerListeners = new Set<() => void>();
  const availabilityListeners = new Set<
    (event: NearbySyncAvailability) => void
  >();
  const discoveryListeners = new Set<
    (event: { endpoints: NearbySyncEndpoint[] }) => void
  >();
  const connectionRequestedListeners = new Set<
    (event: NearbySyncConnectionRequestedEvent) => void
  >();
  const authTokenListeners = new Set<
    (event: NearbySyncAuthTokenEvent) => void
  >();
  const connectionStateListeners = new Set<
    (event: NearbySyncConnectionStateEvent) => void
  >();
  const payloadListeners = new Set<
    (event: NearbySyncPayloadProgressEvent) => void
  >();
  const envelopeListeners = new Set<
    (event: NearbySyncEnvelopeReceivedEvent) => void
  >();
  const errorListeners = new Set<(event: NearbySyncErrorEvent) => void>();
  const logListeners = new Set<(entry: NearbySyncNativeLogEntry) => void>();
  const nfcBootstrapStateListeners = new Set<
    (event: NfcBootstrapStateChangedEvent) => void
  >();
  const nfcBootstrapCompletedListeners = new Set<
    (event: NfcBootstrapCompletedEvent) => void
  >();
  const nfcLogListeners = new Set<(entry: NfcSyncNativeLogEntry) => void>();
  const memoryStorage = createMemoryStorage();

  const defaultAvailability = createReadyAvailability();
  const defaultNfcAvailability = createReadyNfcAvailability();
  const defaultPermissions = createGrantedPermissions();
  const initialBootstrapToken = createSimulatorBootstrapToken();
  const state = {
    advertisedSessionLabel: null as string | null,
    authToken: 'SIM42',
    availability: defaultAvailability,
    cachedPreparedBundle: null as PrepareSyncDeviceBundleResult | null,
    commonBaseTransactionId: args.initialCommonBaseTransactionId ?? null,
    fixtureStrategyId:
      args.initialFixtureStrategyId ?? ('independent-lineages' as const),
    localBootstrapToken: initialBootstrapToken,
    nfcAvailability: defaultNfcAvailability,
    nextPayloadId: 1,
    permissions: defaultPermissions,
    remoteBootstrapToken: initialBootstrapToken,
    remoteProjection: createSyncTestbedRemoteProjection({
      commonBaseTransactionId: args.initialCommonBaseTransactionId ?? null,
      localDocument: args.getLocalDocument(),
      storage: memoryStorage,
      strategyId:
        args.initialFixtureStrategyId ?? ('independent-lineages' as const),
    }),
    remoteSessionId: createBootstrapBoundSessionId(initialBootstrapToken),
    scenarioId: null as SyncTestbedScenarioId | null,
  };

  function notifyControllerListeners() {
    controllerListeners.forEach((listener) => {
      listener();
    });
  }

  function getRemoteEndpoint() {
    return getSimulatorMode() === 'host'
      ? { endpointId: 'sim-joiner-endpoint', endpointName: 'Parent-SIMJ' }
      : { endpointId: 'sim-host-endpoint', endpointName: 'KidPoints-SIMH' };
  }

  function getSimulatorMode() {
    return resolveSimulatorMode(state.fixtureStrategyId);
  }

  function nextPayloadId() {
    const payloadId = `sim-payload-${state.nextPayloadId}`;
    state.nextPayloadId += 1;
    return payloadId;
  }

  function queue(task: () => void) {
    setTimeout(task, 0);
  }

  function emitAvailability() {
    availabilityListeners.forEach((listener) => {
      listener(state.availability);
    });
  }

  function emitDiscovery(endpoints: NearbySyncEndpoint[]) {
    discoveryListeners.forEach((listener) => {
      listener({ endpoints });
    });
  }

  function emitConnectionRequested(event: NearbySyncConnectionRequestedEvent) {
    connectionRequestedListeners.forEach((listener) => {
      listener(event);
    });
  }

  function emitAuthToken(event: NearbySyncAuthTokenEvent) {
    authTokenListeners.forEach((listener) => {
      listener(event);
    });
  }

  function emitConnectionState(event: NearbySyncConnectionStateEvent) {
    connectionStateListeners.forEach((listener) => {
      listener(event);
    });
  }

  function emitPayloadProgress(event: NearbySyncPayloadProgressEvent) {
    payloadListeners.forEach((listener) => {
      listener(event);
    });
  }

  function emitEnvelope(event: NearbySyncEnvelopeReceivedEvent) {
    envelopeListeners.forEach((listener) => {
      listener(event);
    });
  }

  function emitError(event: NearbySyncErrorEvent) {
    errorListeners.forEach((listener) => {
      listener(event);
    });
  }

  function emitLog(entry: NearbySyncNativeLogEntry) {
    logListeners.forEach((listener) => {
      listener(entry);
    });
  }

  function emitNfcBootstrapState(event: NfcBootstrapStateChangedEvent) {
    nfcBootstrapStateListeners.forEach((listener) => {
      listener(event);
    });
  }

  function emitNfcBootstrapCompleted(event: NfcBootstrapCompletedEvent) {
    nfcBootstrapCompletedListeners.forEach((listener) => {
      listener(event);
    });
  }

  function emitNfcLog(entry: NfcSyncNativeLogEntry) {
    nfcLogListeners.forEach((listener) => {
      listener(entry);
    });
  }

  function addListener<T>(
    listeners: Set<(value: T) => void>,
    listener: (value: T) => void,
  ): SyncRuntimeSubscription {
    listeners.add(listener);

    return {
      remove: () => {
        listeners.delete(listener);
      },
    };
  }

  function refreshScenarioState(scenarioId: SyncTestbedScenarioId | null) {
    const bootstrapToken = createSimulatorBootstrapToken();
    const remoteBootstrapToken =
      scenarioId === 'wrong-peer-bootstrap-token'
        ? createSimulatorBootstrapToken()
        : bootstrapToken;

    state.scenarioId = scenarioId;
    state.advertisedSessionLabel = createBootstrapSessionLabel(bootstrapToken);
    state.availability = createReadyAvailability();
    state.cachedPreparedBundle = null;
    state.localBootstrapToken = bootstrapToken;
    state.nfcAvailability = createReadyNfcAvailability();
    state.permissions = createGrantedPermissions();
    state.remoteBootstrapToken = remoteBootstrapToken;
    state.remoteProjection = createSyncTestbedRemoteProjection({
      commonBaseTransactionId: state.commonBaseTransactionId,
      localDocument: args.getLocalDocument(),
      storage: memoryStorage,
      strategyId: state.fixtureStrategyId,
    });
    state.remoteSessionId = createBootstrapBoundSessionId(remoteBootstrapToken);
    state.authToken = 'SIM42';

    if (scenarioId === 'availability-unavailable') {
      state.availability = {
        isReady: false,
        isSupported: false,
        playServicesStatus: null,
        reason: 'module-unavailable',
      };
    }

    if (scenarioId === 'nfc-unsupported') {
      state.nfcAvailability = {
        hasAdapter: false,
        isEnabled: false,
        isReady: false,
        reason: 'nfc-unavailable',
        supportsHce: false,
        supportsReaderMode: false,
      };
    }

    if (scenarioId === 'permissions-denied') {
      state.permissions = {
        allGranted: false,
        deniedPermissions: ['android.permission.BLUETOOTH_CONNECT'],
        requiredPermissions: [
          'android.permission.BLUETOOTH_ADVERTISE',
          'android.permission.BLUETOOTH_CONNECT',
          'android.permission.BLUETOOTH_SCAN',
        ],
        results: {
          'android.permission.BLUETOOTH_ADVERTISE': 'granted',
          'android.permission.BLUETOOTH_CONNECT': 'denied',
          'android.permission.BLUETOOTH_SCAN': 'granted',
        },
      };
    }

    emitAvailability();
    emitDiscovery([]);
    notifyControllerListeners();
  }

  function getPreparedBundleForRemoteProjection() {
    if (state.cachedPreparedBundle) {
      return state.cachedPreparedBundle;
    }

    state.cachedPreparedBundle = prepareSyncDeviceBundle({
      localDocument: args.getLocalDocument(),
      remoteProjection: state.remoteProjection,
    });

    return state.cachedPreparedBundle;
  }

  function emitRemoteEnvelopeWithPayload(envelopeJson: string) {
    emitEnvelope({
      endpointId: getRemoteEndpoint().endpointId,
      envelopeJson,
      payloadId: nextPayloadId(),
    });
  }

  function emitRemoteHello() {
    emitRemoteEnvelopeWithPayload(
      serializeSyncEnvelope(
        createHelloEnvelope({
          bootstrapToken: state.remoteBootstrapToken,
          deviceInstanceId: 'sync-simulator-remote-device',
          sessionId: state.remoteSessionId,
        }),
      ),
    );
  }

  function emitRemoteSummary() {
    emitRemoteEnvelopeWithPayload(
      serializeSyncEnvelope(
        createSummaryEnvelope({
          projection: state.remoteProjection,
          sessionId: state.remoteSessionId,
        }),
      ),
    );
  }

  function emitRemoteSyncResponse(
    args: { accepted?: boolean; reason?: string | null } = {},
  ) {
    emitRemoteEnvelopeWithPayload(
      serializeSyncEnvelope(
        createSyncResponseEnvelope({
          accepted: args.accepted,
          reason: args.reason,
          sessionId: state.remoteSessionId,
        }),
      ),
    );
  }

  function emitRemoteHistoryTransfer(
    args: { invalidFile?: boolean; reverseDeliveryOrder?: boolean } = {},
  ) {
    const exportResult = args.invalidFile
      ? createInvalidProjectionFile()
      : exportSyncProjectionToFile({
          exportId: `sim-remote-${Date.now().toString(36)}`,
          projection: state.remoteProjection,
        });
    const payloadId = nextPayloadId();
    const metaEnvelope = serializeSyncEnvelope(
      createHistoryFileMetaEnvelope({
        exportId: exportResult.exportId,
        fileName: exportResult.fileName,
        payloadId,
        projection: state.remoteProjection,
        sessionId: state.remoteSessionId,
      }),
    );
    const payloadEvent: NearbySyncPayloadProgressEvent = {
      bytesTransferred: exportResult.sizeBytes,
      endpointId: getRemoteEndpoint().endpointId,
      fileUri: exportResult.fileUri,
      payloadId,
      payloadKind: 'file',
      status: 'success',
      totalBytes: exportResult.sizeBytes,
    };

    if (args.reverseDeliveryOrder) {
      emitPayloadProgress(payloadEvent);
      emitEnvelope({
        endpointId: getRemoteEndpoint().endpointId,
        envelopeJson: metaEnvelope,
        payloadId: nextPayloadId(),
      });
      return;
    }

    emitEnvelope({
      endpointId: getRemoteEndpoint().endpointId,
      envelopeJson: metaEnvelope,
      payloadId: nextPayloadId(),
    });
    emitPayloadProgress(payloadEvent);
  }

  function emitRemoteMergeResult(
    args: {
      bundleHashOverride?: string | null;
      mergedHeadSyncHashOverride?: string | null;
    } = {},
  ) {
    const preparedBundle = getPreparedBundleForRemoteProjection();

    if (!preparedBundle.ok) {
      emitError({
        code: preparedBundle.code,
        message: preparedBundle.message,
      });
      return;
    }

    const envelope = createMergeResultEnvelope({
      bundle: preparedBundle.sharedBundle,
      sessionId: state.remoteSessionId,
    });

    emitRemoteEnvelopeWithPayload(
      serializeSyncEnvelope({
        ...envelope,
        bundleHash: args.bundleHashOverride ?? envelope.bundleHash,
        mergedHeadSyncHash:
          args.mergedHeadSyncHashOverride ?? envelope.mergedHeadSyncHash,
      }),
    );
  }

  function emitRemotePrepareAck() {
    const preparedBundle = getPreparedBundleForRemoteProjection();

    if (!preparedBundle.ok) {
      emitError({
        code: preparedBundle.code,
        message: preparedBundle.message,
      });
      return;
    }

    emitRemoteEnvelopeWithPayload(
      serializeSyncEnvelope(
        createPrepareAckEnvelope({
          bundle: preparedBundle.sharedBundle,
          sessionId: state.remoteSessionId,
        }),
      ),
    );
  }

  function emitRemoteCommit() {
    const preparedBundle = getPreparedBundleForRemoteProjection();

    if (!preparedBundle.ok) {
      emitError({
        code: preparedBundle.code,
        message: preparedBundle.message,
      });
      return;
    }

    emitRemoteEnvelopeWithPayload(
      JSON.stringify({
        bundleHash: preparedBundle.sharedBundle.bundleHash,
        protocolVersion: 1,
        sentAt: new Date().toISOString(),
        sessionId: state.remoteSessionId,
        type: 'COMMIT',
      }),
    );
  }

  function emitRemoteCommitAck(
    args: {
      applied?: boolean;
      bundleHash?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    } = {},
  ) {
    const preparedBundle = getPreparedBundleForRemoteProjection();

    if (!preparedBundle.ok) {
      emitError({
        code: preparedBundle.code,
        message: preparedBundle.message,
      });
      return;
    }

    emitRemoteEnvelopeWithPayload(
      serializeSyncEnvelope(
        createCommitAckEnvelope({
          applied: args.applied ?? true,
          bundleHash: args.bundleHash ?? preparedBundle.sharedBundle.bundleHash,
          errorCode: args.errorCode ?? null,
          errorMessage: args.errorMessage ?? null,
          sessionId: state.remoteSessionId,
        }),
      ),
    );
  }

  function emitDisconnect(
    reason: string | null = 'The nearby sync connection was lost.',
  ) {
    const endpoint = getRemoteEndpoint();

    emitConnectionState({
      endpointId: endpoint.endpointId,
      endpointName: endpoint.endpointName,
      reason: reason ?? 'The nearby sync connection was lost.',
      state: 'disconnected',
    });
  }

  function applyScenarioAutoResponse(envelopeJson: string, endpointId: string) {
    const parsedEnvelope = parseSyncEnvelope(envelopeJson);

    if (!parsedEnvelope.ok) {
      return;
    }

    const endpoint = getRemoteEndpoint();

    switch (parsedEnvelope.envelope.type) {
      case 'HELLO':
        queue(() => {
          emitRemoteHello();
        });
        break;
      case 'SYNC_SUMMARY':
        queue(() => {
          emitRemoteSummary();
        });
        break;
      case 'SYNC_REQUEST':
        queue(() => {
          switch (state.scenarioId) {
            case 'sync-response-rejected':
              emitRemoteSyncResponse({
                accepted: false,
                reason: 'The simulated remote device rejected the request.',
              });
              break;
            case 'payload-transfer-failed':
              emitRemoteSyncResponse();
              emitPayloadProgress({
                bytesTransferred: 0,
                endpointId,
                fileUri: null,
                payloadId: nextPayloadId(),
                payloadKind: 'file',
                status: 'failure',
                totalBytes: 2048,
              });
              break;
            case 'disconnect-during-transfer':
              emitRemoteSyncResponse();
              emitConnectionState({
                endpointId: endpoint.endpointId,
                endpointName: endpoint.endpointName,
                reason:
                  'The simulated remote device disconnected mid-transfer.',
                state: 'disconnected',
              });
              break;
            case 'unreadable-remote-projection':
              emitRemoteSyncResponse();
              emitRemoteHistoryTransfer({ invalidFile: true });
              break;
            case 'merged-head-mismatch':
              emitRemoteSyncResponse();
              emitRemoteHistoryTransfer();
              emitRemoteMergeResult({
                mergedHeadSyncHashOverride: 'sim-mismatched-head-hash',
              });
              break;
            case 'bundle-hash-mismatch':
              emitRemoteSyncResponse();
              emitRemoteHistoryTransfer();
              emitRemoteMergeResult({
                bundleHashOverride: 'sim-mismatched-bundle-hash',
              });
              break;
            default:
              emitRemoteSyncResponse();
              emitRemoteHistoryTransfer();
              emitRemoteMergeResult();
              break;
          }
        });
        break;
      case 'PREPARE_ACK':
        if (state.scenarioId !== 'happy-path-review') {
          queue(() => {
            emitRemotePrepareAck();
          });
        }
        break;
      case 'COMMIT':
        queue(() => {
          if (state.scenarioId === 'commit-ack-bundle-mismatch') {
            emitRemoteCommitAck({
              bundleHash: 'sim-remote-bundle-hash-mismatch',
            });
            return;
          }

          emitRemoteCommitAck();
        });
        break;
      case 'ERROR':
      case 'SYNC_RESPONSE':
      case 'HISTORY_FILE_META':
      case 'MERGE_RESULT':
      case 'COMMIT_ACK':
        break;
    }
  }

  const controller: SyncSimulatorController = {
    applyScenario: (scenarioId) => {
      refreshScenarioState(scenarioId);
    },
    emitConnectionRequested: () => {
      const endpoint = getRemoteEndpoint();

      emitConnectionRequested({
        endpointId: endpoint.endpointId,
        endpointName: endpoint.endpointName,
      });
      emitAuthToken({
        authToken: state.authToken,
        endpointId: endpoint.endpointId,
        endpointName: endpoint.endpointName,
        isIncomingConnection: getSimulatorMode() === 'host',
      });
    },
    emitDiscoveryUpdated: () => {
      emitDiscovery([getRemoteEndpoint()]);
    },
    emitDisconnect,
    emitRemoteCommit,
    emitRemoteCommitAck,
    emitRemoteError: (code, message) => {
      emitRemoteEnvelopeWithPayload(
        JSON.stringify({
          code,
          message,
          protocolVersion: 1,
          sentAt: new Date().toISOString(),
          sessionId: state.remoteSessionId,
          type: 'ERROR',
        }),
      );
    },
    emitRemoteHello,
    emitRemoteHistoryTransfer,
    emitRemoteMergeResult,
    emitRemotePrepareAck,
    emitRemoteSummary,
    emitRemoteSyncResponse,
    getDefaultRemoteEndpoint: getRemoteEndpoint,
    getSnapshot: () => ({
      authToken: state.authToken,
      availability: state.availability,
      commonBaseTransactionId: state.commonBaseTransactionId,
      fixtureStrategyId: state.fixtureStrategyId,
      nfcAvailability: state.nfcAvailability,
      permissions: state.permissions,
      remoteEndpoint: getRemoteEndpoint(),
      scenarioId: state.scenarioId,
    }),
    reset: () => {
      const bootstrapToken = createSimulatorBootstrapToken();

      state.nextPayloadId = 1;
      state.advertisedSessionLabel =
        createBootstrapSessionLabel(bootstrapToken);
      state.cachedPreparedBundle = null;
      state.localBootstrapToken = bootstrapToken;
      state.nfcAvailability = createReadyNfcAvailability();
      state.remoteBootstrapToken =
        state.scenarioId === 'wrong-peer-bootstrap-token'
          ? createSimulatorBootstrapToken()
          : bootstrapToken;
      state.remoteProjection = createSyncTestbedRemoteProjection({
        commonBaseTransactionId: state.commonBaseTransactionId,
        localDocument: args.getLocalDocument(),
        storage: memoryStorage,
        strategyId: state.fixtureStrategyId,
      });
      state.remoteSessionId = createBootstrapBoundSessionId(
        state.remoteBootstrapToken,
      );
      emitAvailability();
      emitDiscovery([]);
      notifyControllerListeners();
    },
    setCommonBaseTransactionId: (transactionId) => {
      state.commonBaseTransactionId = transactionId;
      state.cachedPreparedBundle = null;
      state.remoteProjection = createSyncTestbedRemoteProjection({
        commonBaseTransactionId: state.commonBaseTransactionId,
        localDocument: args.getLocalDocument(),
        storage: memoryStorage,
        strategyId: state.fixtureStrategyId,
      });
      notifyControllerListeners();
    },
    setFixtureStrategy: (strategyId) => {
      state.fixtureStrategyId = strategyId;
      state.cachedPreparedBundle = null;
      state.remoteProjection = createSyncTestbedRemoteProjection({
        commonBaseTransactionId: state.commonBaseTransactionId,
        localDocument: args.getLocalDocument(),
        storage: memoryStorage,
        strategyId: state.fixtureStrategyId,
      });
      emitDiscovery([]);
      notifyControllerListeners();
    },
    subscribe: (listener) => {
      controllerListeners.add(listener);

      return () => {
        controllerListeners.delete(listener);
      };
    },
  };

  const runtime: NearbySyncRuntime = {
    acceptConnection: async () => {
      state.cachedPreparedBundle = null;
      const endpoint = getRemoteEndpoint();

      if (state.scenarioId === 'connection-rejected') {
        queue(() => {
          emitConnectionState({
            endpointId: endpoint.endpointId,
            endpointName: endpoint.endpointName,
            reason: 'The simulated remote device rejected the connection.',
            state: 'rejected',
          });
        });
        return;
      }

      queue(() => {
        emitConnectionState({
          endpointId: endpoint.endpointId,
          endpointName: endpoint.endpointName,
          reason: null,
          state: 'connected',
        });
      });
    },
    addAuthTokenReadyListener: (listener) =>
      addListener(authTokenListeners, listener),
    addAvailabilityChangeListener: (listener) =>
      addListener(availabilityListeners, listener),
    addConnectionRequestedListener: (listener) =>
      addListener(connectionRequestedListeners, listener),
    addConnectionStateChangedListener: (listener) =>
      addListener(connectionStateListeners, listener),
    addDiscoveryUpdatedListener: (listener) =>
      addListener(discoveryListeners, listener),
    addEnvelopeReceivedListener: (listener) =>
      addListener(envelopeListeners, listener),
    addErrorListener: (listener) => addListener(errorListeners, listener),
    addNearbySyncLogListener: (listener) => addListener(logListeners, listener),
    addPayloadProgressListener: (listener) =>
      addListener(payloadListeners, listener),
    addNfcBootstrapCompletedListener: (listener) =>
      addListener(nfcBootstrapCompletedListeners, listener),
    addNfcBootstrapStateChangedListener: (listener) =>
      addListener(nfcBootstrapStateListeners, listener),
    addNfcSyncLogListener: (listener) => addListener(nfcLogListeners, listener),
    beginNfcBootstrap: async () => {
      const attemptId = `sim-nfc-${Date.now().toString(36)}`;
      const role = getSimulatorMode() === 'host' ? 'host' : 'join';

      if (!state.nfcAvailability.isReady) {
        emitNfcBootstrapState({
          attemptId,
          failureReason: state.nfcAvailability.reason,
          message: 'The simulated device cannot start NFC sync.',
          phase: 'error',
          role: null,
        });
        return;
      }

      emitNfcLog({
        contextJson: JSON.stringify({ attemptId, role }),
        level: 'info',
        message: 'Simulator NFC bootstrap started',
        sequence: state.nextPayloadId,
        tag: 'sync-simulator-runtime',
        timestampMs: Date.now(),
      });
      emitNfcBootstrapState({
        attemptId,
        failureReason: null,
        message: 'Hold both phones together to simulate the NFC tap.',
        phase: 'starting',
        role: null,
      });

      queue(() => {
        emitNfcBootstrapState({
          attemptId,
          failureReason: null,
          message:
            role === 'host'
              ? 'Simulated device is listening for the tap.'
              : 'Simulated device is scanning for its partner.',
          phase: role === 'host' ? 'hce-active' : 'reader-active',
          role: null,
        });

        if (state.scenarioId === 'nfc-bootstrap-timeout') {
          queue(() => {
            emitNfcBootstrapState({
              attemptId,
              failureReason: 'timeout',
              message: 'The simulated NFC tap timed out.',
              phase: 'error',
              role: null,
            });
          });
          return;
        }

        queue(() => {
          emitNfcBootstrapState({
            attemptId,
            failureReason: null,
            message: 'Phones matched. Starting nearby sync.',
            phase: 'completed',
            role,
          });
          emitNfcBootstrapCompleted({
            attemptId,
            bootstrapToken: state.localBootstrapToken,
            peerDeviceHash: 'sim-peer-hash',
            role,
          });
        });
      });
    },
    cancelNfcBootstrap: async () => undefined,
    disconnect: async () => undefined,
    getBufferedNearbySyncLogs: () => [],
    getBufferedNfcSyncLogs: () => [],
    getNfcBootstrapAvailability: async () => state.nfcAvailability,
    isAvailable: async () => state.availability,
    requestConnection: async () => {
      state.cachedPreparedBundle = null;
      const endpoint = getRemoteEndpoint();

      queue(() => {
        emitConnectionState({
          endpointId: endpoint.endpointId,
          endpointName: endpoint.endpointName,
          reason: null,
          state: 'connecting',
        });
        emitAuthToken({
          authToken: state.authToken,
          endpointId: endpoint.endpointId,
          endpointName: endpoint.endpointName,
          isIncomingConnection: false,
        });
      });
    },
    rejectConnection: async () => undefined,
    requestPermissions: async () => state.permissions,
    sendEnvelope: async ({ endpointId, envelopeJson }) => {
      const payloadId = nextPayloadId();

      emitLog({
        contextJson: JSON.stringify({ envelopeJson }),
        level: 'debug',
        message: 'Simulator envelope sent',
        sequence: state.nextPayloadId,
        tag: 'sync-simulator-runtime',
        timestampMs: Date.now(),
      });
      applyScenarioAutoResponse(envelopeJson, endpointId);

      return payloadId;
    },
    sendFile: async () => nextPayloadId(),
    startDiscovery: async () => {
      emitDiscovery([
        {
          endpointId: getRemoteEndpoint().endpointId,
          endpointName:
            state.advertisedSessionLabel ?? getRemoteEndpoint().endpointName,
        },
      ]);
    },
    startHosting: async ({ sessionLabel }) => {
      state.advertisedSessionLabel = sessionLabel;
      queue(() => {
        controller.emitConnectionRequested();
      });
    },
    stopAll: async () => undefined,
  };

  return {
    controller,
    runtime,
  };
}

function createReadyAvailability(): NearbySyncAvailability {
  return {
    isReady: true,
    isSupported: true,
    playServicesStatus: 0,
    reason: 'ready',
  };
}

function createReadyNfcAvailability(): NfcBootstrapAvailability {
  return {
    hasAdapter: true,
    isEnabled: true,
    isReady: true,
    reason: 'ready',
    supportsHce: true,
    supportsReaderMode: true,
  };
}

function createSimulatorBootstrapToken() {
  return `sim-bootstrap-${Math.random().toString(36).slice(2, 14)}`;
}

function resolveSimulatorMode(strategyId: SyncTestbedFixtureStrategyId) {
  return strategyId === 'bootstrap-right-to-left' ? 'joiner' : 'host';
}

function createGrantedPermissions(): NearbySyncPermissionStatus {
  return {
    allGranted: true,
    deniedPermissions: [],
    requiredPermissions: [
      'android.permission.BLUETOOTH_ADVERTISE',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN',
    ],
    results: {
      'android.permission.BLUETOOTH_ADVERTISE': 'granted',
      'android.permission.BLUETOOTH_CONNECT': 'granted',
      'android.permission.BLUETOOTH_SCAN': 'granted',
    },
  };
}

function createMemoryStorage(): StateStorage {
  const data = new Map<string, string>();

  return {
    getItem: async (name) => data.get(name) ?? null,
    removeItem: async (name) => {
      data.delete(name);
    },
    setItem: async (name, value) => {
      data.set(name, value);
    },
  };
}

function createInvalidProjectionFile() {
  const exportId = `sim-invalid-${Date.now().toString(36)}`;
  const fileName = `${exportId}.json`;
  const file = new File(Paths.cache, fileName);
  const contents = '{"invalid":true';

  file.write(contents);

  return {
    exportId,
    fileName,
    fileUri: file.uri,
    sizeBytes: new TextEncoder().encode(contents).byteLength,
  };
}
