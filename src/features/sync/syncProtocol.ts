import Constants from 'expo-constants';
import type { SyncBundle, SyncProjection } from '../../state/sharedSync';

export const SYNC_PROTOCOL_VERSION = 1 as const;
export const SYNC_TRANSPORT = 'nearby' as const;
const SESSION_LABEL_PREFIX = 'KidPoints';

export type SyncTransport = typeof SYNC_TRANSPORT;
export type SyncEnvelopeType =
  | 'COMMIT'
  | 'COMMIT_ACK'
  | 'ERROR'
  | 'HELLO'
  | 'HISTORY_FILE_META'
  | 'MERGE_RESULT'
  | 'PREPARE_ACK'
  | 'SYNC_REQUEST'
  | 'SYNC_RESPONSE'
  | 'SYNC_SUMMARY';

export type SyncHelloEnvelope = {
  appVersion: string;
  capabilities: string[];
  deviceInstanceId: string;
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  sentAt: string;
  sessionId: string;
  transport: SyncTransport;
  type: 'HELLO';
};

export type SyncSummaryEnvelope = {
  entryCount: number;
  headHash: string;
  headSyncHash: string;
  isBootstrappable: boolean;
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  sentAt: string;
  sessionId: string;
  syncSchemaVersion: number;
  type: 'SYNC_SUMMARY';
};

export type SyncRequestEnvelope = {
  projectionRequested: true;
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  sentAt: string;
  sessionId: string;
  type: 'SYNC_REQUEST';
};

export type SyncResponseEnvelope = {
  accepted: boolean;
  projectionOffered: boolean;
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  reason: string | null;
  sentAt: string;
  sessionId: string;
  type: 'SYNC_RESPONSE';
};

export type HistoryFileMetaEnvelope = {
  entryCount: number;
  exportId: string;
  fileName: string;
  headHash: string;
  headSyncHash: string;
  payloadId: string;
  projectionScope: SyncProjection['scope'];
  projectionSyncSchemaVersion: SyncProjection['syncSchemaVersion'];
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  sentAt: string;
  sessionId: string;
  type: 'HISTORY_FILE_META';
};

export type MergeResultEnvelope = {
  bundleHash: string;
  childReconciliationCount: number;
  commonBaseHash: string | null;
  mergedChildCount: number;
  mergedHeadSyncHash: string;
  mode: SyncBundle['mode'];
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  sentAt: string;
  sessionId: string;
  type: 'MERGE_RESULT';
};

export type PrepareAckEnvelope = {
  bundleHash: string;
  mergedHeadSyncHash: string;
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  sentAt: string;
  sessionId: string;
  type: 'PREPARE_ACK';
  userConfirmed: true;
};

export type CommitEnvelope = {
  bundleHash: string;
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  sentAt: string;
  sessionId: string;
  type: 'COMMIT';
};

export type CommitAckEnvelope = {
  applied: boolean;
  bundleHash: string;
  errorCode: string | null;
  errorMessage: string | null;
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  sentAt: string;
  sessionId: string;
  type: 'COMMIT_ACK';
};

export type SyncErrorEnvelope = {
  code: string;
  message: string;
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  sentAt: string;
  sessionId: string;
  type: 'ERROR';
};

export type SyncEnvelope =
  | CommitAckEnvelope
  | CommitEnvelope
  | HistoryFileMetaEnvelope
  | MergeResultEnvelope
  | PrepareAckEnvelope
  | SyncErrorEnvelope
  | SyncHelloEnvelope
  | SyncRequestEnvelope
  | SyncResponseEnvelope
  | SyncSummaryEnvelope;

export type ParseSyncEnvelopeResult =
  | { envelope: SyncEnvelope; ok: true }
  | {
      code: 'invalid-json' | 'invalid-shape' | 'unsupported-envelope';
      message: string;
      ok: false;
    };

export type SyncMergeReviewSummary = {
  bundleHash: string;
  childReconciliationCount: number;
  commonBaseHash: string | null;
  mergedChildCount: number;
  mergedHeadSyncHash: string;
  mode: SyncBundle['mode'];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasSharedEnvelopeBase(value: unknown): value is {
  protocolVersion: number;
  sentAt: string;
  sessionId: string;
  type: SyncEnvelopeType;
} {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.type) &&
    isString(value.sessionId) &&
    isString(value.sentAt) &&
    value.protocolVersion === SYNC_PROTOCOL_VERSION
  );
}

export function createSyncSessionId() {
  return `sync-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function createSessionLabel() {
  return `${SESSION_LABEL_PREFIX}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

export function createParticipantLabel(deviceInstanceId: string) {
  return `Parent-${deviceInstanceId.slice(-4).toUpperCase()}`;
}

export function getAppVersionLabel() {
  return (
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    'unknown-version'
  );
}

export function createHelloEnvelope(args: {
  deviceInstanceId: string;
  sessionId: string;
}): SyncHelloEnvelope {
  return {
    appVersion: getAppVersionLabel(),
    capabilities: ['projection-file-transfer', 'bundle-hash-agreement'],
    deviceInstanceId: args.deviceInstanceId,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sentAt: new Date().toISOString(),
    sessionId: args.sessionId,
    transport: SYNC_TRANSPORT,
    type: 'HELLO',
  };
}

export function createSummaryEnvelope(args: {
  projection: SyncProjection;
  sessionId: string;
}): SyncSummaryEnvelope {
  return {
    entryCount: args.projection.entries.length,
    headHash: args.projection.headHash,
    headSyncHash: args.projection.headSyncHash,
    isBootstrappable: args.projection.entries.length === 0,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sentAt: new Date().toISOString(),
    sessionId: args.sessionId,
    syncSchemaVersion: args.projection.syncSchemaVersion,
    type: 'SYNC_SUMMARY',
  };
}

export function createSyncRequestEnvelope(
  sessionId: string,
): SyncRequestEnvelope {
  return {
    projectionRequested: true,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sentAt: new Date().toISOString(),
    sessionId,
    type: 'SYNC_REQUEST',
  };
}

export function createSyncResponseEnvelope(args: {
  accepted?: boolean;
  reason?: string | null;
  sessionId: string;
}): SyncResponseEnvelope {
  return {
    accepted: args.accepted ?? true,
    projectionOffered: args.accepted ?? true,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    reason: args.reason ?? null,
    sentAt: new Date().toISOString(),
    sessionId: args.sessionId,
    type: 'SYNC_RESPONSE',
  };
}

export function createHistoryFileMetaEnvelope(args: {
  exportId: string;
  fileName: string;
  payloadId: string;
  projection: SyncProjection;
  sessionId: string;
}): HistoryFileMetaEnvelope {
  return {
    entryCount: args.projection.entries.length,
    exportId: args.exportId,
    fileName: args.fileName,
    headHash: args.projection.headHash,
    headSyncHash: args.projection.headSyncHash,
    payloadId: args.payloadId,
    projectionScope: args.projection.scope,
    projectionSyncSchemaVersion: args.projection.syncSchemaVersion,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sentAt: new Date().toISOString(),
    sessionId: args.sessionId,
    type: 'HISTORY_FILE_META',
  };
}

export function createMergeResultEnvelope(args: {
  bundle: SyncBundle;
  sessionId: string;
}): MergeResultEnvelope {
  return {
    bundleHash: args.bundle.bundleHash,
    childReconciliationCount: args.bundle.childReconciliations.length,
    commonBaseHash: args.bundle.commonBaseHash,
    mergedChildCount: Object.keys(args.bundle.mergedHead.childrenById).length,
    mergedHeadSyncHash: args.bundle.mergedHeadSyncHash,
    mode: args.bundle.mode,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sentAt: new Date().toISOString(),
    sessionId: args.sessionId,
    type: 'MERGE_RESULT',
  };
}

export function createPrepareAckEnvelope(args: {
  bundle: SyncBundle;
  sessionId: string;
}): PrepareAckEnvelope {
  return {
    bundleHash: args.bundle.bundleHash,
    mergedHeadSyncHash: args.bundle.mergedHeadSyncHash,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sentAt: new Date().toISOString(),
    sessionId: args.sessionId,
    type: 'PREPARE_ACK',
    userConfirmed: true,
  };
}

export function createCommitEnvelope(args: {
  bundleHash: string;
  sessionId: string;
}): CommitEnvelope {
  return {
    bundleHash: args.bundleHash,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sentAt: new Date().toISOString(),
    sessionId: args.sessionId,
    type: 'COMMIT',
  };
}

export function createCommitAckEnvelope(args: {
  applied: boolean;
  bundleHash: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  sessionId: string;
}): CommitAckEnvelope {
  return {
    applied: args.applied,
    bundleHash: args.bundleHash,
    errorCode: args.errorCode ?? null,
    errorMessage: args.errorMessage ?? null,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sentAt: new Date().toISOString(),
    sessionId: args.sessionId,
    type: 'COMMIT_ACK',
  };
}

export function createSyncErrorEnvelope(args: {
  code: string;
  message: string;
  sessionId: string;
}): SyncErrorEnvelope {
  return {
    code: args.code,
    message: args.message,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sentAt: new Date().toISOString(),
    sessionId: args.sessionId,
    type: 'ERROR',
  };
}

export function serializeSyncEnvelope(envelope: SyncEnvelope) {
  return JSON.stringify(envelope);
}

export function parseSyncEnvelope(
  envelopeJson: string,
): ParseSyncEnvelopeResult {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(envelopeJson);
  } catch {
    return {
      code: 'invalid-json',
      message: 'The sync envelope payload was not valid JSON.',
      ok: false,
    };
  }

  if (!hasSharedEnvelopeBase(parsedValue)) {
    return {
      code: 'invalid-shape',
      message: 'The sync envelope payload was missing shared fields.',
      ok: false,
    };
  }

  const envelope = parsedValue as Record<string, unknown> & {
    protocolVersion: number;
    sentAt: string;
    sessionId: string;
    type: SyncEnvelopeType;
  };

  switch (envelope.type) {
    case 'HELLO':
      if (
        isString(envelope.appVersion) &&
        Array.isArray(envelope.capabilities) &&
        envelope.capabilities.every(isString) &&
        isString(envelope.deviceInstanceId) &&
        envelope.transport === SYNC_TRANSPORT
      ) {
        return { envelope: envelope as unknown as SyncHelloEnvelope, ok: true };
      }
      break;
    case 'SYNC_SUMMARY':
      if (
        isNumber(envelope.entryCount) &&
        isString(envelope.headHash) &&
        isString(envelope.headSyncHash) &&
        isBoolean(envelope.isBootstrappable) &&
        isNumber(envelope.syncSchemaVersion)
      ) {
        return {
          envelope: envelope as unknown as SyncSummaryEnvelope,
          ok: true,
        };
      }
      break;
    case 'SYNC_REQUEST':
      if (envelope.projectionRequested === true) {
        return {
          envelope: envelope as unknown as SyncRequestEnvelope,
          ok: true,
        };
      }
      break;
    case 'SYNC_RESPONSE':
      if (
        isBoolean(envelope.accepted) &&
        isBoolean(envelope.projectionOffered) &&
        (envelope.reason === null || typeof envelope.reason === 'string')
      ) {
        return {
          envelope: envelope as unknown as SyncResponseEnvelope,
          ok: true,
        };
      }
      break;
    case 'HISTORY_FILE_META':
      if (
        isNumber(envelope.entryCount) &&
        isString(envelope.exportId) &&
        isString(envelope.fileName) &&
        isString(envelope.headHash) &&
        isString(envelope.headSyncHash) &&
        isString(envelope.payloadId) &&
        envelope.projectionScope === 'child-ledger' &&
        envelope.projectionSyncSchemaVersion === 1
      ) {
        return {
          envelope: envelope as unknown as HistoryFileMetaEnvelope,
          ok: true,
        };
      }
      break;
    case 'MERGE_RESULT':
      if (
        isString(envelope.bundleHash) &&
        isNumber(envelope.childReconciliationCount) &&
        (envelope.commonBaseHash === null ||
          typeof envelope.commonBaseHash === 'string') &&
        isNumber(envelope.mergedChildCount) &&
        isString(envelope.mergedHeadSyncHash) &&
        (envelope.mode === 'bootstrap' || envelope.mode === 'merged')
      ) {
        return {
          envelope: envelope as unknown as MergeResultEnvelope,
          ok: true,
        };
      }
      break;
    case 'PREPARE_ACK':
      if (
        isString(envelope.bundleHash) &&
        isString(envelope.mergedHeadSyncHash) &&
        envelope.userConfirmed === true
      ) {
        return {
          envelope: envelope as unknown as PrepareAckEnvelope,
          ok: true,
        };
      }
      break;
    case 'COMMIT':
      if (isString(envelope.bundleHash)) {
        return { envelope: envelope as unknown as CommitEnvelope, ok: true };
      }
      break;
    case 'COMMIT_ACK':
      if (
        isBoolean(envelope.applied) &&
        isString(envelope.bundleHash) &&
        (envelope.errorCode === null ||
          typeof envelope.errorCode === 'string') &&
        (envelope.errorMessage === null ||
          typeof envelope.errorMessage === 'string')
      ) {
        return {
          envelope: envelope as unknown as CommitAckEnvelope,
          ok: true,
        };
      }
      break;
    case 'ERROR':
      if (isString(envelope.code) && isString(envelope.message)) {
        return {
          envelope: envelope as unknown as SyncErrorEnvelope,
          ok: true,
        };
      }
      break;
    default:
      return {
        code: 'unsupported-envelope',
        message: `Unsupported sync envelope type ${String(envelope.type)}.`,
        ok: false,
      };
  }

  return {
    code: 'invalid-shape',
    message: `The sync envelope payload for ${envelope.type} was invalid.`,
    ok: false,
  };
}

export function buildMergeReviewSummary(
  bundle: SyncBundle,
): SyncMergeReviewSummary {
  return {
    bundleHash: bundle.bundleHash,
    childReconciliationCount: bundle.childReconciliations.length,
    commonBaseHash: bundle.commonBaseHash,
    mergedChildCount: Object.keys(bundle.mergedHead.childrenById).length,
    mergedHeadSyncHash: bundle.mergedHeadSyncHash,
    mode: bundle.mode,
  };
}

export function truncateHashForLog(hash: string | null | undefined) {
  if (!hash) {
    return null;
  }

  return hash.slice(0, 14);
}

export function buildSyncLoggerContext(args: {
  bundleHash?: string | null;
  endpointId?: string | null;
  payloadId?: string | null;
  phase?: string | null;
  sessionId?: string | null;
}) {
  return {
    bundleHashPrefix: truncateHashForLog(args.bundleHash),
    endpointId: args.endpointId ?? null,
    payloadId: args.payloadId ?? null,
    phase: args.phase ?? null,
    sessionId: args.sessionId ?? null,
  };
}
