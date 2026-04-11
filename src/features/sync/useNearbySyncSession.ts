import { useEffect, useReducer, useRef } from 'react';

import { createModuleLogger } from '../../logging/logger';
import { connectNativeLogReceiver } from '../../logging/nativeLogSync';
import { useSharedStore } from '../../state/sharedStore';
import {
  deriveSyncProjection,
  type PrepareSyncDeviceBundleResult,
  prepareSyncDeviceBundle,
} from '../../state/sharedSync';
import type { SharedCommandResult } from '../../state/sharedTypes';
import type {
  NearbySyncConnectionStateEvent,
  NearbySyncEndpoint,
  NearbySyncEnvelopeReceivedEvent,
  NearbySyncNativeLogEntry,
  NearbySyncPayloadProgressEvent,
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
import { useSyncRuntime } from './syncRuntimeContext';
import {
  buildSyncSessionSummary,
  createInitialSyncSessionState,
  reduceSyncSessionState,
  type SyncSessionState,
} from './syncSessionMachine';

const log = createModuleLogger('nearby-sync-session');

type PreparedBundle = Extract<PrepareSyncDeviceBundleResult, { ok: true }>;
export type NearbySyncSessionController = {
  acceptPairingCode: () => Promise<void>;
  cancelSession: () => Promise<void>;
  confirmMergeAndPrepareCommit: () => Promise<void>;
  connectToEndpoint: (endpoint: NearbySyncEndpoint) => Promise<void>;
  refreshAvailability: () => Promise<void>;
  rejectPairingCode: () => Promise<void>;
  revertLastAppliedSync: () => Promise<SharedCommandResult>;
  startHostFlow: () => Promise<void>;
  startJoinFlow: () => Promise<void>;
  state: SyncSessionState;
};

function waitForMs(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toEndpoint(args: {
  endpointId: string;
  endpointName: string;
}): NearbySyncEndpoint {
  return {
    endpointId: args.endpointId,
    endpointName: args.endpointName,
  };
}

function createPermissionsRejectedMessage(args: {
  deniedPermissions: string[];
}) {
  if (args.deniedPermissions.length === 0) {
    return 'Nearby sync needs the required nearby-device permissions before it can start.';
  }

  return `Nearby sync needs the required nearby-device permissions before it can start. Missing: ${args.deniedPermissions.join(', ')}.`;
}

function createAvailabilityRejectedMessage() {
  return 'Nearby sync is unavailable because Google Play services could not be used on this device.';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function normalizeSessionStartFailureReason(reason: string) {
  if (reason.includes('MISSING_PERMISSION_BLUETOOTH_ADVERTISE')) {
    return 'Bluetooth advertise permission is missing on this device.';
  }

  if (reason.includes('MISSING_PERMISSION_ACCESS_COARSE_LOCATION')) {
    return 'Nearby discovery location permission is missing on this device.';
  }

  if (reason.includes('MISSING_PERMISSION_ACCESS_FINE_LOCATION')) {
    return 'Nearby discovery precise location permission is missing on this device.';
  }

  return reason.replace(/\s+/g, ' ').trim();
}

function createSessionStartFailureMessage(
  role: 'host' | 'join',
  error: unknown,
) {
  const baseMessage =
    role === 'host'
      ? 'Nearby sync hosting could not start.'
      : 'Nearby sync discovery could not start.';
  const reason = normalizeSessionStartFailureReason(getErrorMessage(error));

  return reason ? `${baseMessage} ${reason}` : baseMessage;
}

export function useNearbySyncSession(): NearbySyncSessionController {
  const runtime = useSyncRuntime();
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
  const pairingDecisionInFlightRef = useRef(false);
  const commitSucceededRef = useRef(false);
  const stopAllInFlightRef = useRef(false);
  const historyMetaByPayloadIdRef = useRef(
    new Map<string, HistoryFileMetaEnvelope>(),
  );
  const completedFileUrisByPayloadIdRef = useRef(new Map<string, string>());
  const effectOpsRef = useRef({
    bestEffortStopAll: async () => {},
    failSession: async (_args: {
      code: string;
      message: string;
      sendRemoteError?: boolean;
    }) => {},
    maybeProcessIncomingHistoryFile: async (_payloadId: string) => {},
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
    pairingDecisionInFlightRef.current = false;
    commitSucceededRef.current = false;
    stopAllInFlightRef.current = false;
    historyMetaByPayloadIdRef.current.clear();
    completedFileUrisByPayloadIdRef.current.clear();
  }

  async function bestEffortStopAll() {
    if (stopAllInFlightRef.current) {
      return;
    }

    stopAllInFlightRef.current = true;
    try {
      await runtime.stopAll();
    } catch (error) {
      log.warn('Failed to stop nearby sync activity cleanly', {
        ...buildSyncLoggerContext({
          phase: stateRef.current.phase,
          sessionId: stateRef.current.sessionId,
        }),
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      stopAllInFlightRef.current = false;
    }
  }

  async function refreshAvailability() {
    dispatch({
      availability: await runtime.isAvailable(),
      type: 'availabilityUpdated',
    });
  }

  async function failSession(args: {
    code: string;
    message: string;
    sendRemoteError?: boolean;
  }) {
    if (commitSucceededRef.current) {
      log.debug('Ignoring nearby sync failure after a completed commit', {
        ...buildSyncLoggerContext({
          endpointId: stateRef.current.connectedEndpoint?.endpointId ?? null,
          phase: stateRef.current.phase,
          sessionId: stateRef.current.sessionId,
        }),
        code: args.code,
        message: args.message,
      });
      return;
    }

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
        await runtime.sendEnvelope({
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
    const payloadId = await runtime.sendEnvelope({ endpointId, envelopeJson });

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

    localProjectionSentRef.current = true;

    const projection = deriveSyncProjection(documentRef.current);
    const exportResult = exportSyncProjectionToFile({ projection });
    try {
      const payloadId = await runtime.sendFile({
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

      dispatch({
        progress: {
          bytesTransferred: 0,
          payloadId,
          status: 'in-progress',
          totalBytes: exportResult.sizeBytes,
        },
        type: 'transferUpdated',
      });
    } catch (error) {
      localProjectionSentRef.current = false;
      throw error;
    }
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

  async function prepareBundleFromRemoteProjection(args: {
    payloadId: string;
    remoteProjectionFileUri: string;
  }) {
    const { payloadId, remoteProjectionFileUri } = args;
    const localDocument = documentRef.current;
    let loadedProjection = loadSyncProjectionFromFile(remoteProjectionFileUri);

    if (!loadedProjection.ok) {
      log.warn('Retrying unreadable nearby sync history file', {
        ...buildSyncLoggerContext({
          endpointId: stateRef.current.connectedEndpoint?.endpointId ?? null,
          payloadId,
          phase: stateRef.current.phase,
          sessionId: stateRef.current.sessionId,
        }),
        fileUri: remoteProjectionFileUri,
      });
      await waitForMs(100);
      loadedProjection = loadSyncProjectionFromFile(remoteProjectionFileUri);
    }

    if (!loadedProjection.ok) {
      log.error('Received nearby sync history file could not be loaded', {
        ...buildSyncLoggerContext({
          endpointId: stateRef.current.connectedEndpoint?.endpointId ?? null,
          payloadId,
          phase: stateRef.current.phase,
          sessionId: stateRef.current.sessionId,
        }),
        fileUri: remoteProjectionFileUri,
      });
    }

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

  async function maybeProcessIncomingHistoryFile(payloadId: string) {
    const meta = historyMetaByPayloadIdRef.current.get(payloadId);
    const fileUri = completedFileUrisByPayloadIdRef.current.get(payloadId);

    if (!meta || !fileUri) {
      log.debug('Nearby sync history file is still waiting for its pair', {
        ...buildSyncLoggerContext({
          endpointId: stateRef.current.connectedEndpoint?.endpointId ?? null,
          payloadId,
          phase: stateRef.current.phase,
          sessionId: stateRef.current.sessionId,
        }),
        hasFileUri: Boolean(fileUri),
        hasHistoryMeta: Boolean(meta),
      });
      return;
    }

    historyMetaByPayloadIdRef.current.delete(payloadId);
    completedFileUrisByPayloadIdRef.current.delete(payloadId);
    await prepareBundleFromRemoteProjection({
      payloadId,
      remoteProjectionFileUri: fileUri,
    });
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

  async function finalizeSuccessfulCommit(
    bundle: PreparedBundle['sharedBundle'],
  ) {
    commitSucceededRef.current = true;
    dispatch({
      review: buildMergeReviewSummary(bundle),
      type: 'commitSucceeded',
    });
    await bestEffortStopAll();
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
    await finalizeSuccessfulCommit(preparedBundle.sharedBundle);
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

    await finalizeSuccessfulCommit(preparedBundle.sharedBundle);
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

    const availabilitySubscription = runtime.addAvailabilityChangeListener(
      (availability) => {
        dispatch({
          availability,
          type: 'availabilityUpdated',
        });
      },
    );
    const discoverySubscription = runtime.addDiscoveryUpdatedListener(
      (event) => {
        dispatch({
          endpoints: event.endpoints,
          type: 'discoveryUpdated',
        });
      },
    );
    const connectionRequestedSubscription =
      runtime.addConnectionRequestedListener((event) => {
        log.debug('Nearby sync connection request received', {
          ...buildSyncLoggerContext({
            endpointId: event.endpointId,
            phase: stateRef.current.phase,
            sessionId: stateRef.current.sessionId,
          }),
          endpointName: event.endpointName,
        });
        dispatch({
          endpoint: toEndpoint(event),
          type: 'pairingStarted',
        });
      });
    const authTokenSubscription = runtime.addAuthTokenReadyListener((event) => {
      log.info('Nearby sync pairing token ready', {
        ...buildSyncLoggerContext({
          endpointId: event.endpointId,
          phase: stateRef.current.phase,
          sessionId: stateRef.current.sessionId,
        }),
        endpointName: event.endpointName,
        isIncomingConnection: event.isIncomingConnection,
      });
      dispatch({
        authToken: event.authToken,
        endpoint: toEndpoint(event),
        type: 'authTokenReady',
      });
    });
    const connectionStateSubscription =
      runtime.addConnectionStateChangedListener(
        (event: NearbySyncConnectionStateEvent) => {
          log.debug('Nearby sync connection state changed', {
            ...buildSyncLoggerContext({
              endpointId: event.endpointId,
              phase: stateRef.current.phase,
              sessionId: stateRef.current.sessionId,
            }),
            endpointName: event.endpointName,
            reason: event.reason,
            state: event.state,
          });

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

          if (event.state === 'requested') {
            log.debug('Ignoring redundant nearby sync requested state event', {
              ...buildSyncLoggerContext({
                endpointId: event.endpointId,
                phase: stateRef.current.phase,
                sessionId: stateRef.current.sessionId,
              }),
              endpointName: event.endpointName,
            });
            return;
          }

          if (event.state === 'connecting') {
            if (
              stateRef.current.phase === 'pairing' &&
              stateRef.current.authToken
            ) {
              log.debug(
                'Ignoring redundant nearby sync connecting state event',
                {
                  ...buildSyncLoggerContext({
                    endpointId: event.endpointId,
                    phase: stateRef.current.phase,
                    sessionId: stateRef.current.sessionId,
                  }),
                  endpointName: event.endpointName,
                },
              );
              return;
            }

            dispatch({
              endpoint: toEndpoint(event),
              type: 'pairingStarted',
            });
            return;
          }

          if (
            stateRef.current.phase === 'idle' ||
            stateRef.current.phase === 'success' ||
            commitSucceededRef.current ||
            stopAllInFlightRef.current
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
    const payloadProgressSubscription = runtime.addPayloadProgressListener(
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
          log.info('Nearby sync file payload completed', {
            ...buildSyncLoggerContext({
              endpointId: event.endpointId,
              payloadId: event.payloadId,
              phase: stateRef.current.phase,
              sessionId: stateRef.current.sessionId,
            }),
            fileUri: event.fileUri,
          });
          completedFileUrisByPayloadIdRef.current.set(
            event.payloadId,
            event.fileUri,
          );
          void effectOpsRef.current.maybeProcessIncomingHistoryFile(
            event.payloadId,
          );
          return;
        }

        if (event.status === 'success' && event.payloadKind === 'file') {
          log.warn('Nearby sync file payload completed without a file URI', {
            ...buildSyncLoggerContext({
              endpointId: event.endpointId,
              payloadId: event.payloadId,
              phase: stateRef.current.phase,
              sessionId: stateRef.current.sessionId,
            }),
          });
        }

        if (event.status === 'failure' || event.status === 'canceled') {
          if (commitSucceededRef.current || stopAllInFlightRef.current) {
            log.debug(
              'Ignoring nearby sync payload failure during intentional teardown',
              {
                ...buildSyncLoggerContext({
                  endpointId: event.endpointId,
                  payloadId: event.payloadId,
                  phase: stateRef.current.phase,
                  sessionId: stateRef.current.sessionId,
                }),
                status: event.status,
              },
            );
            return;
          }

          void effectOpsRef.current.failSession({
            code: 'payload-transfer-failed',
            message: 'A nearby sync payload transfer failed before completion.',
            sendRemoteError: true,
          });
        }
      },
    );
    const envelopeSubscription = runtime.addEnvelopeReceivedListener(
      (event) => {
        void handleEnvelopeReceivedRef.current(event);
      },
    );
    const errorSubscription = runtime.addErrorListener((event) => {
      void effectOpsRef.current.failSession({
        code: event.code,
        message: event.message,
      });
    });

    const removeNativeLogSync =
      connectNativeLogReceiver<NearbySyncNativeLogEntry>({
        addLogListener: runtime.addNearbySyncLogListener,
        getBufferedEntries: runtime.getBufferedNearbySyncLogs,
        getLastSeenSequence: () => lastSeenNativeLogSequenceRef.current,
        parseContextJson: (contextJson) => (contextJson ? { contextJson } : {}),
        setLastSeenSequence: (sequence) => {
          lastSeenNativeLogSequenceRef.current = sequence;
        },
      });

    return () => {
      availabilitySubscription?.remove();
      discoverySubscription?.remove();
      connectionRequestedSubscription?.remove();
      authTokenSubscription?.remove();
      connectionStateSubscription?.remove();
      payloadProgressSubscription?.remove();
      envelopeSubscription?.remove();
      errorSubscription?.remove();
      removeNativeLogSync();

      if (
        stateRef.current.phase !== 'idle' &&
        stateRef.current.phase !== 'success' &&
        stateRef.current.phase !== 'error'
      ) {
        void effectOpsRef.current.bestEffortStopAll();
      }
    };
  }, [runtime]);

  async function beginSession(role: 'host' | 'join') {
    const availability = await runtime.isAvailable();

    dispatch({ availability, type: 'availabilityUpdated' });

    if (!availability.isReady) {
      await failSession({
        code: availability.reason,
        message: createAvailabilityRejectedMessage(),
      });
      return;
    }

    const permissions = await runtime.requestPermissions();
    dispatch({ permissions, type: 'permissionsUpdated' });

    if (!permissions.allGranted) {
      await failSession({
        code: 'permissions-denied',
        message: createPermissionsRejectedMessage({
          deniedPermissions: permissions.deniedPermissions,
        }),
      });
      return;
    }

    const sessionId = createSyncSessionId();
    const sessionLabel = role === 'host' ? createSessionLabel() : null;
    const localEndpointName = createParticipantLabel(
      documentRef.current.deviceId,
    );

    resetEphemeralSessionRefs();
    try {
      if (role === 'host') {
        await runtime.startHosting({
          localEndpointName,
          sessionLabel: sessionLabel ?? createSessionLabel(),
        });
      } else {
        await runtime.startDiscovery({ localEndpointName });
      }

      dispatch({
        role,
        sessionId,
        sessionLabel,
        type: 'sessionStarted',
      });

      log.info(
        role === 'host'
          ? 'Nearby sync hosting started'
          : 'Nearby sync discovery started',
        {
          ...buildSyncLoggerContext({
            phase: role === 'host' ? 'hosting' : 'discovering',
            sessionId,
          }),
          localEndpointName,
          sessionLabel,
        },
      );
    } catch (error) {
      const message = createSessionStartFailureMessage(role, error);

      log.error('Nearby sync transport startup failed', {
        ...buildSyncLoggerContext({
          phase: 'idle',
          sessionId,
        }),
        error: getErrorMessage(error),
        localEndpointName,
        role,
        sessionLabel,
      });
      await bestEffortStopAll();
      resetEphemeralSessionRefs();
      await failSession({
        code:
          role === 'host' ? 'start-hosting-failed' : 'start-discovery-failed',
        message,
      });
    }
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
    await runtime.requestConnection(endpoint.endpointId);
  }

  async function acceptPairingCode() {
    const endpointId = stateRef.current.connectedEndpoint?.endpointId;

    if (!endpointId || pairingDecisionInFlightRef.current) {
      return;
    }

    pairingDecisionInFlightRef.current = true;

    try {
      await runtime.acceptConnection(endpointId);
      log.info('Nearby sync pairing code accepted', {
        ...buildSyncLoggerContext({
          endpointId,
          phase: stateRef.current.phase,
          sessionId: stateRef.current.sessionId,
        }),
        authToken: stateRef.current.authToken,
      });
    } catch (error) {
      pairingDecisionInFlightRef.current = false;
      await failSession({
        code: 'accept-connection-failed',
        message: `The nearby sync connection could not be accepted. ${getErrorMessage(error)}`,
      });
    }
  }

  async function rejectPairingCode() {
    const endpointId = stateRef.current.connectedEndpoint?.endpointId;

    if (!endpointId || pairingDecisionInFlightRef.current) {
      return;
    }

    pairingDecisionInFlightRef.current = true;

    try {
      await runtime.rejectConnection(endpointId);
      await failSession({
        code: 'pairing-rejected',
        message:
          'The pairing code was rejected and the sync session was canceled.',
      });
    } finally {
      pairingDecisionInFlightRef.current = false;
    }
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
      await runtime.disconnect(stateRef.current.connectedEndpoint.endpointId);
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
