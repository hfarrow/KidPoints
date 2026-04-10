import { useEffect, useReducer, useRef } from 'react';

import {
  createModuleLogger,
  logForwardedNativeEntry,
} from '../../logging/logger';
import { useSharedStore } from '../../state/sharedStore';
import {
  deriveSyncProjection,
  type PrepareSyncDeviceBundleResult,
  prepareSyncDeviceBundle,
} from '../../state/sharedSync';
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
  type NearbySyncConnectionStateEvent,
  type NearbySyncEndpoint,
  type NearbySyncEnvelopeReceivedEvent,
  type NearbySyncNativeLogEntry,
  type NearbySyncPayloadProgressEvent,
  rejectConnection,
  requestConnection,
  requestPermissions,
  sendEnvelope,
  sendFile,
  startDiscovery,
  startHosting,
  stopAll,
} from './nearbySyncBridge';
import {
  exportSyncProjectionToFile,
  loadSyncProjectionFromFile,
} from './syncFileTransfer';
import {
  buildMergeReviewSummary,
  buildSyncLoggerContext,
  type CommitAckEnvelope,
  type CommitEnvelope,
  createCommitAckEnvelope,
  createCommitEnvelope,
  createHelloEnvelope,
  createHistoryFileMetaEnvelope,
  createMergeResultEnvelope,
  createParticipantLabel,
  createPrepareAckEnvelope,
  createSessionLabel,
  createSummaryEnvelope,
  createSyncErrorEnvelope,
  createSyncRequestEnvelope,
  createSyncResponseEnvelope,
  createSyncSessionId,
  type HistoryFileMetaEnvelope,
  type MergeResultEnvelope,
  parseSyncEnvelope,
  type SyncHelloEnvelope,
  type SyncSummaryEnvelope,
  serializeSyncEnvelope,
} from './syncProtocol';
import {
  buildSyncSessionSummary,
  createInitialSyncSessionState,
  reduceSyncSessionState,
} from './syncSessionMachine';

const log = createModuleLogger('nearby-sync-session');
const nativeLog = createModuleLogger('nearby-sync-native');

type PreparedBundle = Extract<PrepareSyncDeviceBundleResult, { ok: true }>;

function toEndpoint(args: {
  endpointId: string;
  endpointName: string;
}): NearbySyncEndpoint {
  return {
    endpointId: args.endpointId,
    endpointName: args.endpointName,
  };
}

function createPermissionsRejectedMessage() {
  return 'Nearby sync needs the required nearby-device permissions before it can start.';
}

function createAvailabilityRejectedMessage() {
  return 'Nearby sync is unavailable because Google Play services could not be used on this device.';
}

export function useNearbySyncSession() {
  const document = useSharedStore((state) => state.document);
  const applySyncBundle = useSharedStore((state) => state.applySyncBundle);
  const revertLastSync = useSharedStore((state) => state.revertLastSync);
  const [state, dispatch] = useReducer(
    reduceSyncSessionState,
    undefined,
    createInitialSyncSessionState,
  );
  const stateRef = useRef(state);
  const documentRef = useRef(document);
  const remoteHelloRef = useRef<SyncHelloEnvelope | null>(null);
  const remoteSummaryRef = useRef<SyncSummaryEnvelope | null>(null);
  const remoteMergeResultRef = useRef<MergeResultEnvelope | null>(null);
  const localPreparedBundleRef = useRef<PreparedBundle | null>(null);
  const lastSeenNativeLogSequenceRef = useRef(-1);
  const localHelloSentRef = useRef(false);
  const localSummarySentRef = useRef(false);
  const historyRequestSentRef = useRef(false);
  const localProjectionSentRef = useRef(false);
  const localMergeResultSentRef = useRef(false);
  const localCommitIssuedRef = useRef(false);
  const localPrepareConfirmedRef = useRef(false);
  const remotePrepareConfirmedRef = useRef(false);
  const historyMetaByPayloadIdRef = useRef(
    new Map<number, HistoryFileMetaEnvelope>(),
  );
  const completedFileUrisByPayloadIdRef = useRef(new Map<number, string>());
  const effectOpsRef = useRef({
    bestEffortStopAll: async () => {},
    failSession: async (_args: {
      code: string;
      message: string;
      sendRemoteError?: boolean;
    }) => {},
    maybeProcessIncomingHistoryFile: async (_payloadId: number) => {},
    refreshAvailability: async () => {},
    sendHelloIfNeeded: async (_endpointId: string) => {},
    sendSummaryIfNeeded: async (_endpointId: string) => {},
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  function resetEphemeralSessionRefs() {
    remoteHelloRef.current = null;
    remoteSummaryRef.current = null;
    remoteMergeResultRef.current = null;
    localPreparedBundleRef.current = null;
    localHelloSentRef.current = false;
    localSummarySentRef.current = false;
    historyRequestSentRef.current = false;
    localProjectionSentRef.current = false;
    localMergeResultSentRef.current = false;
    localCommitIssuedRef.current = false;
    localPrepareConfirmedRef.current = false;
    remotePrepareConfirmedRef.current = false;
    historyMetaByPayloadIdRef.current.clear();
    completedFileUrisByPayloadIdRef.current.clear();
  }

  async function bestEffortStopAll() {
    try {
      await stopAll();
    } catch (error) {
      log.warn('Failed to stop nearby sync activity cleanly', {
        ...buildSyncLoggerContext({
          phase: stateRef.current.phase,
          sessionId: stateRef.current.sessionId,
        }),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function refreshAvailability() {
    dispatch({
      availability: await isAvailable(),
      type: 'availabilityUpdated',
    });
  }

  async function failSession(args: {
    code: string;
    message: string;
    sendRemoteError?: boolean;
  }) {
    const sessionState = stateRef.current;
    const endpointId = sessionState.connectedEndpoint?.endpointId ?? null;

    log.error('Nearby sync session failed', {
      ...buildSyncLoggerContext({
        endpointId,
        phase: sessionState.phase,
        sessionId: sessionState.sessionId,
      }),
      code: args.code,
      message: args.message,
    });
    dispatch({
      code: args.code,
      message: args.message,
      type: 'sessionFailed',
    });

    if (args.sendRemoteError && endpointId && sessionState.sessionId) {
      try {
        await sendEnvelope({
          endpointId,
          envelopeJson: serializeSyncEnvelope(
            createSyncErrorEnvelope({
              code: args.code,
              message: args.message,
              sessionId: sessionState.sessionId,
            }),
          ),
        });
      } catch {
        // Best effort only.
      }
    }
  }

  async function sendProtocolEnvelope(
    endpointId: string,
    envelopeJson: string,
    details: Record<string, unknown> = {},
  ) {
    const payloadId = await sendEnvelope({ endpointId, envelopeJson });

    log.debug('Nearby sync envelope sent', {
      ...buildSyncLoggerContext({
        endpointId,
        payloadId,
        phase: stateRef.current.phase,
        sessionId: stateRef.current.sessionId,
      }),
      ...details,
    });

    return payloadId;
  }

  async function sendHelloIfNeeded(endpointId: string) {
    if (localHelloSentRef.current || !stateRef.current.sessionId) {
      return;
    }

    localHelloSentRef.current = true;
    await sendProtocolEnvelope(
      endpointId,
      serializeSyncEnvelope(
        createHelloEnvelope({
          deviceInstanceId: documentRef.current.deviceId,
          sessionId: stateRef.current.sessionId,
        }),
      ),
      { envelopeType: 'HELLO' },
    );
  }

  async function sendSummaryIfNeeded(endpointId: string) {
    if (localSummarySentRef.current || !stateRef.current.sessionId) {
      return;
    }

    const projection = deriveSyncProjection(documentRef.current);

    localSummarySentRef.current = true;
    await sendProtocolEnvelope(
      endpointId,
      serializeSyncEnvelope(
        createSummaryEnvelope({
          projection,
          sessionId: stateRef.current.sessionId,
        }),
      ),
      {
        envelopeType: 'SYNC_SUMMARY',
        headHash: projection.headHash,
        headSyncHash: projection.headSyncHash,
      },
    );
  }

  async function sendHistoryRequestIfNeeded(endpointId: string) {
    if (
      historyRequestSentRef.current ||
      !stateRef.current.sessionId ||
      !remoteSummaryRef.current
    ) {
      return;
    }

    historyRequestSentRef.current = true;
    await sendProtocolEnvelope(
      endpointId,
      serializeSyncEnvelope(
        createSyncRequestEnvelope(stateRef.current.sessionId),
      ),
      { envelopeType: 'SYNC_REQUEST' },
    );
  }

  async function sendProjectionFileIfNeeded(endpointId: string) {
    if (localProjectionSentRef.current || !stateRef.current.sessionId) {
      return;
    }

    const projection = deriveSyncProjection(documentRef.current);
    const exportResult = exportSyncProjectionToFile({ projection });
    const payloadId = await sendFile({
      endpointId,
      fileUri: exportResult.fileUri,
    });

    await sendProtocolEnvelope(
      endpointId,
      serializeSyncEnvelope(
        createHistoryFileMetaEnvelope({
          exportId: exportResult.exportId,
          fileName: exportResult.fileName,
          payloadId,
          projection,
          sessionId: stateRef.current.sessionId,
        }),
      ),
      {
        envelopeType: 'HISTORY_FILE_META',
        payloadId,
        sizeBytes: exportResult.sizeBytes,
      },
    );
    localProjectionSentRef.current = true;

    dispatch({
      progress: {
        bytesTransferred: 0,
        payloadId,
        status: 'in-progress',
        totalBytes: exportResult.sizeBytes,
      },
      type: 'transferUpdated',
    });
  }

  async function maybeEnterReview() {
    const localPreparedBundle = localPreparedBundleRef.current;
    const remoteMergeResult = remoteMergeResultRef.current;

    if (!localPreparedBundle || !remoteMergeResult) {
      return;
    }

    if (
      localPreparedBundle.sharedBundle.mergedHeadSyncHash !==
      remoteMergeResult.mergedHeadSyncHash
    ) {
      await failSession({
        code: 'merged-head-sync-hash-mismatch',
        message:
          'The devices derived different merged sync head hashes and cannot continue.',
        sendRemoteError: true,
      });
      return;
    }

    if (
      localPreparedBundle.sharedBundle.bundleHash !==
      remoteMergeResult.bundleHash
    ) {
      await failSession({
        code: 'bundle-hash-mismatch',
        message:
          'The devices derived different sync bundles and cannot continue.',
        sendRemoteError: true,
      });
      return;
    }

    dispatch({
      peerEndpointName:
        stateRef.current.connectedEndpoint?.endpointName ?? null,
      review: buildSyncSessionSummary(localPreparedBundle.sharedBundle),
      type: 'reviewReady',
    });
  }

  async function prepareBundleFromRemoteProjection(
    remoteProjectionFileUri: string,
  ) {
    const localDocument = documentRef.current;
    const loadedProjection = loadSyncProjectionFromFile(
      remoteProjectionFileUri,
    );

    if (!loadedProjection.ok) {
      await failSession({
        code: 'remote-projection-invalid',
        message: loadedProjection.error,
        sendRemoteError: true,
      });
      return;
    }

    const preparedBundle = prepareSyncDeviceBundle({
      localDocument,
      remoteProjection: loadedProjection.projection,
    });

    if (!preparedBundle.ok) {
      await failSession({
        code: preparedBundle.code,
        message: preparedBundle.message,
        sendRemoteError: true,
      });
      return;
    }

    localPreparedBundleRef.current = preparedBundle;

    if (
      stateRef.current.connectedEndpoint?.endpointId &&
      !localMergeResultSentRef.current
    ) {
      localMergeResultSentRef.current = true;
      await sendProtocolEnvelope(
        stateRef.current.connectedEndpoint.endpointId,
        serializeSyncEnvelope(
          createMergeResultEnvelope({
            bundle: preparedBundle.sharedBundle,
            sessionId: stateRef.current.sessionId ?? createSyncSessionId(),
          }),
        ),
        {
          bundleHash: preparedBundle.sharedBundle.bundleHash,
          envelopeType: 'MERGE_RESULT',
          mergedHeadSyncHash: preparedBundle.sharedBundle.mergedHeadSyncHash,
        },
      );
    }

    await maybeEnterReview();
  }

  async function maybeProcessIncomingHistoryFile(payloadId: number) {
    const meta = historyMetaByPayloadIdRef.current.get(payloadId);
    const fileUri = completedFileUrisByPayloadIdRef.current.get(payloadId);

    if (!meta || !fileUri) {
      return;
    }

    historyMetaByPayloadIdRef.current.delete(payloadId);
    completedFileUrisByPayloadIdRef.current.delete(payloadId);
    await prepareBundleFromRemoteProjection(fileUri);
  }

  async function applyPreparedBundle(bundleHash: string) {
    const preparedBundle = localPreparedBundleRef.current;

    if (!preparedBundle) {
      return {
        error: 'The sync bundle was not prepared before commit.',
        ok: false as const,
      };
    }

    if (
      documentRef.current.syncState?.lastAppliedSync?.bundleHash === bundleHash
    ) {
      log.info('Nearby sync bundle already applied locally', {
        ...buildSyncLoggerContext({
          bundleHash,
          endpointId: stateRef.current.connectedEndpoint?.endpointId ?? null,
          phase: stateRef.current.phase,
          sessionId: stateRef.current.sessionId,
        }),
      });
      return { ok: true as const };
    }

    return applySyncBundle(
      preparedBundle.sharedBundle,
      preparedBundle.localRollbackSnapshot,
    );
  }

  async function issueCommitIfReady() {
    const sessionState = stateRef.current;
    const endpointId = sessionState.connectedEndpoint?.endpointId;
    const preparedBundle = localPreparedBundleRef.current;

    if (
      !endpointId ||
      !preparedBundle ||
      localCommitIssuedRef.current ||
      !localPrepareConfirmedRef.current ||
      !remotePrepareConfirmedRef.current
    ) {
      return;
    }

    localCommitIssuedRef.current = true;
    dispatch({ type: 'commitStarted' });

    await sendProtocolEnvelope(
      endpointId,
      serializeSyncEnvelope(
        createCommitEnvelope({
          bundleHash: preparedBundle.sharedBundle.bundleHash,
          sessionId: sessionState.sessionId ?? createSyncSessionId(),
        }),
      ),
      {
        bundleHash: preparedBundle.sharedBundle.bundleHash,
        envelopeType: 'COMMIT',
      },
    );

    const applyResult = await applyPreparedBundle(
      preparedBundle.sharedBundle.bundleHash,
    );

    if (!applyResult.ok) {
      await failSession({
        code: 'commit-apply-failed',
        message: applyResult.error,
        sendRemoteError: true,
      });
    }
  }

  async function handleRemoteCommit(envelope: CommitEnvelope) {
    const preparedBundle = localPreparedBundleRef.current;
    const endpointId = stateRef.current.connectedEndpoint?.endpointId;

    if (!preparedBundle || !endpointId) {
      await failSession({
        code: 'commit-without-prepared-bundle',
        message:
          'The remote device requested commit before preparation completed.',
        sendRemoteError: true,
      });
      return;
    }

    if (!localPrepareConfirmedRef.current) {
      await failSession({
        code: 'commit-before-local-confirmation',
        message:
          'The remote device requested commit before local confirmation.',
        sendRemoteError: true,
      });
      return;
    }

    dispatch({ type: 'commitStarted' });
    const applyResult = await applyPreparedBundle(envelope.bundleHash);

    if (!applyResult.ok) {
      await sendProtocolEnvelope(
        endpointId,
        serializeSyncEnvelope(
          createCommitAckEnvelope({
            applied: false,
            bundleHash: envelope.bundleHash,
            errorCode: 'commit-apply-failed',
            errorMessage: applyResult.error,
            sessionId: stateRef.current.sessionId ?? createSyncSessionId(),
          }),
        ),
        {
          bundleHash: envelope.bundleHash,
          envelopeType: 'COMMIT_ACK',
        },
      );
      await failSession({
        code: 'commit-apply-failed',
        message: applyResult.error,
      });
      return;
    }

    await sendProtocolEnvelope(
      endpointId,
      serializeSyncEnvelope(
        createCommitAckEnvelope({
          applied: true,
          bundleHash: envelope.bundleHash,
          sessionId: stateRef.current.sessionId ?? createSyncSessionId(),
        }),
      ),
      {
        bundleHash: envelope.bundleHash,
        envelopeType: 'COMMIT_ACK',
      },
    );
    dispatch({
      review: buildMergeReviewSummary(preparedBundle.sharedBundle),
      type: 'commitSucceeded',
    });
    await bestEffortStopAll();
  }

  async function handleRemoteCommitAck(envelope: CommitAckEnvelope) {
    const preparedBundle = localPreparedBundleRef.current;

    if (!preparedBundle) {
      return;
    }

    if (!envelope.applied) {
      await failSession({
        code: envelope.errorCode ?? 'remote-commit-failed',
        message:
          envelope.errorMessage ??
          'The remote device reported a commit failure.',
      });
      return;
    }

    if (envelope.bundleHash !== preparedBundle.sharedBundle.bundleHash) {
      await failSession({
        code: 'commit-ack-bundle-mismatch',
        message: 'The remote device acknowledged a different sync bundle hash.',
      });
      return;
    }

    dispatch({
      review: buildMergeReviewSummary(preparedBundle.sharedBundle),
      type: 'commitSucceeded',
    });
    await bestEffortStopAll();
  }

  const handleEnvelopeReceivedRef = useRef(
    async (_event: NearbySyncEnvelopeReceivedEvent) => {},
  );

  handleEnvelopeReceivedRef.current = async (
    event: NearbySyncEnvelopeReceivedEvent,
  ) => {
    const parsedEnvelope = parseSyncEnvelope(event.envelopeJson);

    if (!parsedEnvelope.ok) {
      await failSession({
        code: parsedEnvelope.code,
        message: parsedEnvelope.message,
        sendRemoteError: true,
      });
      return;
    }

    const envelope = parsedEnvelope.envelope;

    log.debug('Nearby sync envelope received', {
      ...buildSyncLoggerContext({
        endpointId: event.endpointId,
        payloadId: event.payloadId,
        phase: stateRef.current.phase,
        sessionId: stateRef.current.sessionId,
      }),
      envelopeType: envelope.type,
    });

    switch (envelope.type) {
      case 'HELLO':
        remoteHelloRef.current = envelope;
        await sendSummaryIfNeeded(event.endpointId);
        break;
      case 'SYNC_SUMMARY':
        remoteSummaryRef.current = envelope;
        await sendHistoryRequestIfNeeded(event.endpointId);
        break;
      case 'SYNC_REQUEST':
        await sendProtocolEnvelope(
          event.endpointId,
          serializeSyncEnvelope(
            createSyncResponseEnvelope({
              accepted: true,
              sessionId: stateRef.current.sessionId ?? createSyncSessionId(),
            }),
          ),
          { envelopeType: 'SYNC_RESPONSE' },
        );
        await sendProjectionFileIfNeeded(event.endpointId);
        break;
      case 'SYNC_RESPONSE':
        if (!envelope.accepted) {
          await failSession({
            code: 'sync-response-rejected',
            message:
              envelope.reason ??
              'The remote device rejected the sync history request.',
          });
          return;
        }

        await sendProjectionFileIfNeeded(event.endpointId);
        break;
      case 'HISTORY_FILE_META':
        historyMetaByPayloadIdRef.current.set(envelope.payloadId, envelope);
        await maybeProcessIncomingHistoryFile(envelope.payloadId);
        break;
      case 'MERGE_RESULT':
        remoteMergeResultRef.current = envelope;
        await maybeEnterReview();
        break;
      case 'PREPARE_ACK':
        remotePrepareConfirmedRef.current = true;
        dispatch({ type: 'peerPrepareConfirmed' });
        await issueCommitIfReady();
        break;
      case 'COMMIT':
        await handleRemoteCommit(envelope);
        break;
      case 'COMMIT_ACK':
        await handleRemoteCommitAck(envelope);
        break;
      case 'ERROR':
        await failSession({
          code: envelope.code,
          message: envelope.message,
        });
        break;
    }
  };

  useEffect(() => {
    void effectOpsRef.current.refreshAvailability();

    const availabilitySubscription = addAvailabilityChangeListener(
      (availability) => {
        dispatch({
          availability,
          type: 'availabilityUpdated',
        });
      },
    );
    const discoverySubscription = addDiscoveryUpdatedListener((event) => {
      dispatch({
        endpoints: event.endpoints,
        type: 'discoveryUpdated',
      });
    });
    const connectionRequestedSubscription = addConnectionRequestedListener(
      (event) => {
        dispatch({
          endpoint: toEndpoint(event),
          type: 'pairingStarted',
        });
      },
    );
    const authTokenSubscription = addAuthTokenReadyListener((event) => {
      dispatch({
        authToken: event.authToken,
        endpoint: toEndpoint(event),
        type: 'authTokenReady',
      });
    });
    const connectionStateSubscription = addConnectionStateChangedListener(
      (event: NearbySyncConnectionStateEvent) => {
        if (event.state === 'connected') {
          dispatch({
            endpoint: toEndpoint(event),
            type: 'connected',
          });
          void effectOpsRef.current.sendHelloIfNeeded(event.endpointId);
          if (remoteHelloRef.current) {
            void effectOpsRef.current.sendSummaryIfNeeded(event.endpointId);
          }
          return;
        }

        if (event.state === 'requested' || event.state === 'connecting') {
          dispatch({
            endpoint: toEndpoint(event),
            type: 'pairingStarted',
          });
          return;
        }

        if (
          stateRef.current.phase === 'idle' ||
          stateRef.current.phase === 'success'
        ) {
          return;
        }

        void effectOpsRef.current.failSession({
          code:
            event.state === 'rejected'
              ? 'connection-rejected'
              : 'connection-disconnected',
          message:
            event.reason ??
            (event.state === 'rejected'
              ? 'The connection was rejected.'
              : 'The nearby sync connection was lost.'),
        });
      },
    );
    const payloadProgressSubscription = addPayloadProgressListener(
      (event: NearbySyncPayloadProgressEvent) => {
        dispatch({
          progress: {
            bytesTransferred: event.bytesTransferred,
            payloadId: event.payloadId,
            status: event.status,
            totalBytes: event.totalBytes,
          },
          type: 'transferUpdated',
        });

        if (
          event.status === 'success' &&
          event.payloadKind === 'file' &&
          event.fileUri
        ) {
          completedFileUrisByPayloadIdRef.current.set(
            event.payloadId,
            event.fileUri,
          );
          void effectOpsRef.current.maybeProcessIncomingHistoryFile(
            event.payloadId,
          );
          return;
        }

        if (event.status === 'failure' || event.status === 'canceled') {
          void effectOpsRef.current.failSession({
            code: 'payload-transfer-failed',
            message: 'A nearby sync payload transfer failed before completion.',
            sendRemoteError: true,
          });
        }
      },
    );
    const envelopeSubscription = addEnvelopeReceivedListener((event) => {
      void handleEnvelopeReceivedRef.current(event);
    });
    const errorSubscription = addErrorListener((event) => {
      void effectOpsRef.current.failSession({
        code: event.code,
        message: event.message,
      });
    });

    let isCancelled = false;
    let bufferedLogsReplayed = false;
    const queuedLiveEntries: NearbySyncNativeLogEntry[] = [];
    const forwardNearbyNativeLog = (entry: NearbySyncNativeLogEntry) => {
      if (entry.sequence <= lastSeenNativeLogSequenceRef.current) {
        return;
      }

      lastSeenNativeLogSequenceRef.current = entry.sequence;
      logForwardedNativeEntry(
        nativeLog,
        entry,
        entry.contextJson ? { contextJson: entry.contextJson } : {},
      );
    };
    const logSubscription = addNearbySyncLogListener((entry) => {
      if (isCancelled) {
        return;
      }

      if (!bufferedLogsReplayed) {
        queuedLiveEntries.push(entry);
        return;
      }

      forwardNearbyNativeLog(entry);
    });

    const bufferedEntries = getBufferedNearbySyncLogs(
      lastSeenNativeLogSequenceRef.current,
    );

    bufferedEntries.forEach((entry) => {
      forwardNearbyNativeLog(entry);
    });
    bufferedLogsReplayed = true;
    queuedLiveEntries.forEach((entry) => {
      forwardNearbyNativeLog(entry);
    });

    return () => {
      isCancelled = true;
      availabilitySubscription?.remove();
      discoverySubscription?.remove();
      connectionRequestedSubscription?.remove();
      authTokenSubscription?.remove();
      connectionStateSubscription?.remove();
      payloadProgressSubscription?.remove();
      envelopeSubscription?.remove();
      errorSubscription?.remove();
      logSubscription?.remove();

      if (
        stateRef.current.phase !== 'idle' &&
        stateRef.current.phase !== 'success' &&
        stateRef.current.phase !== 'error'
      ) {
        void effectOpsRef.current.bestEffortStopAll();
      }
    };
  }, []);

  async function beginSession(role: 'host' | 'join') {
    const availability = await isAvailable();

    dispatch({ availability, type: 'availabilityUpdated' });

    if (!availability.isReady) {
      await failSession({
        code: availability.reason,
        message: createAvailabilityRejectedMessage(),
      });
      return;
    }

    const permissions = await requestPermissions();
    dispatch({ permissions, type: 'permissionsUpdated' });

    if (!permissions.allGranted) {
      await failSession({
        code: 'permissions-denied',
        message: createPermissionsRejectedMessage(),
      });
      return;
    }

    const sessionId = createSyncSessionId();
    const sessionLabel = role === 'host' ? createSessionLabel() : null;
    const localEndpointName = createParticipantLabel(
      documentRef.current.deviceId,
    );

    resetEphemeralSessionRefs();
    dispatch({
      role,
      sessionId,
      sessionLabel,
      type: 'sessionStarted',
    });

    if (role === 'host') {
      await startHosting({
        localEndpointName,
        sessionLabel: sessionLabel ?? createSessionLabel(),
      });
      log.info('Nearby sync hosting started', {
        ...buildSyncLoggerContext({
          phase: 'hosting',
          sessionId,
        }),
        localEndpointName,
        sessionLabel,
      });
      return;
    }

    await startDiscovery({ localEndpointName });
    log.info('Nearby sync discovery started', {
      ...buildSyncLoggerContext({
        phase: 'discovering',
        sessionId,
      }),
      localEndpointName,
    });
  }

  async function startHostFlow() {
    await beginSession('host');
  }

  async function startJoinFlow() {
    await beginSession('join');
  }

  async function connectToEndpoint(endpoint: NearbySyncEndpoint) {
    dispatch({
      endpoint,
      type: 'pairingStarted',
    });
    await requestConnection(endpoint.endpointId);
  }

  async function acceptPairingCode() {
    const endpointId = stateRef.current.connectedEndpoint?.endpointId;

    if (!endpointId) {
      return;
    }

    await acceptConnection(endpointId);
    log.info('Nearby sync pairing code accepted', {
      ...buildSyncLoggerContext({
        endpointId,
        phase: stateRef.current.phase,
        sessionId: stateRef.current.sessionId,
      }),
      authToken: stateRef.current.authToken,
    });
  }

  async function rejectPairingCode() {
    const endpointId = stateRef.current.connectedEndpoint?.endpointId;

    if (!endpointId) {
      return;
    }

    await rejectConnection(endpointId);
    await failSession({
      code: 'pairing-rejected',
      message:
        'The pairing code was rejected and the sync session was canceled.',
    });
  }

  async function confirmMergeAndPrepareCommit() {
    const preparedBundle = localPreparedBundleRef.current;
    const endpointId = stateRef.current.connectedEndpoint?.endpointId;

    if (!preparedBundle || !endpointId) {
      return;
    }

    localPrepareConfirmedRef.current = true;
    dispatch({ type: 'prepareConfirmed' });
    await sendProtocolEnvelope(
      endpointId,
      serializeSyncEnvelope(
        createPrepareAckEnvelope({
          bundle: preparedBundle.sharedBundle,
          sessionId: stateRef.current.sessionId ?? createSyncSessionId(),
        }),
      ),
      {
        bundleHash: preparedBundle.sharedBundle.bundleHash,
        envelopeType: 'PREPARE_ACK',
      },
    );
    await issueCommitIfReady();
  }

  async function cancelSession() {
    if (stateRef.current.connectedEndpoint?.endpointId) {
      await disconnect(stateRef.current.connectedEndpoint.endpointId);
    }
    await bestEffortStopAll();
    resetEphemeralSessionRefs();
    dispatch({ type: 'sessionReset' });
    log.info('Nearby sync session reset');
  }

  async function revertLastAppliedSync() {
    const result = revertLastSync();

    if (!result.ok) {
      await failSession({
        code: 'revert-last-sync-failed',
        message: result.error,
      });
      return result;
    }

    log.info('Nearby sync rollback applied locally', {
      ...buildSyncLoggerContext({
        bundleHash:
          documentRef.current.syncState?.lastAppliedSync?.bundleHash ?? null,
        phase: stateRef.current.phase,
        sessionId: stateRef.current.sessionId,
      }),
    });
    return result;
  }

  effectOpsRef.current = {
    bestEffortStopAll,
    failSession,
    maybeProcessIncomingHistoryFile,
    refreshAvailability,
    sendHelloIfNeeded,
    sendSummaryIfNeeded,
  };

  return {
    acceptPairingCode,
    cancelSession,
    confirmMergeAndPrepareCommit,
    connectToEndpoint,
    refreshAvailability,
    rejectPairingCode,
    revertLastAppliedSync,
    startHostFlow,
    startJoinFlow,
    state,
  };
}
