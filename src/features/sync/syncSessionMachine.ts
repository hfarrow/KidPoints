import type { SyncBundle } from '../../state/sharedSync';
import type {
  NfcBootstrapAvailability,
  NfcBootstrapRole,
  NfcBootstrapStateChangedEvent,
} from './nfcSyncBridge';
import {
  buildSyncLoggerContext,
  type SyncMergeReviewSummary,
} from './syncProtocol';

export type SyncRole = 'host' | 'join' | null;
export type SyncSessionPhase =
  | 'bootstrapping'
  | 'committing'
  | 'connecting'
  | 'discovering'
  | 'error'
  | 'hosting'
  | 'idle'
  | 'pairing'
  | 'review'
  | 'success'
  | 'transferring';

export type SyncTransportAvailability = {
  isReady: boolean;
  isSupported: boolean;
  playServicesStatus: number | null;
  reason:
    | 'module-unavailable'
    | 'play-services-error'
    | 'play-services-missing'
    | 'ready';
};

export type SyncPermissionsState = {
  allGranted: boolean;
  deniedPermissions: string[];
  requiredPermissions: string[];
  results: Record<string, string>;
};

export type SyncNearbyEndpoint = {
  endpointId: string;
  endpointName: string;
};

export type SyncTransferProgress = {
  bytesTransferred: number | null;
  payloadId: string | null;
  status: 'canceled' | 'failure' | 'idle' | 'in-progress' | 'success';
  totalBytes: number | null;
};

export type SyncNfcBootstrapState = {
  attemptId: string | null;
  failureReason: string | null;
  message: string | null;
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

export type SyncSessionState = {
  authToken: string | null;
  availability: SyncTransportAvailability;
  connectedEndpoint: SyncNearbyEndpoint | null;
  discoveredEndpoints: SyncNearbyEndpoint[];
  errorCode: string | null;
  errorMessage: string | null;
  isAwaitingPeerPrepare: boolean;
  localPrepareConfirmed: boolean;
  nfcAvailability: NfcBootstrapAvailability;
  nfcBootstrap: SyncNfcBootstrapState;
  permissions: SyncPermissionsState;
  phase: SyncSessionPhase;
  review:
    | (SyncMergeReviewSummary & {
        peerEndpointName: string | null;
      })
    | null;
  role: SyncRole;
  sessionId: string | null;
  sessionLabel: string | null;
  transferProgress: SyncTransferProgress;
};

export type SyncSessionAction =
  | {
      availability: SyncTransportAvailability;
      type: 'availabilityUpdated';
    }
  | {
      availability: NfcBootstrapAvailability;
      type: 'nfcAvailabilityUpdated';
    }
  | {
      permissions: SyncPermissionsState;
      type: 'permissionsUpdated';
    }
  | {
      nfcBootstrap: NfcBootstrapStateChangedEvent;
      type: 'nfcBootstrapStateChanged';
    }
  | {
      role: Exclude<SyncRole, null>;
      sessionId: string;
      sessionLabel: string | null;
      type: 'sessionStarted';
    }
  | {
      endpoints: SyncNearbyEndpoint[];
      type: 'discoveryUpdated';
    }
  | {
      endpoint: SyncNearbyEndpoint;
      type: 'pairingStarted';
    }
  | {
      authToken: string;
      endpoint: SyncNearbyEndpoint;
      type: 'authTokenReady';
    }
  | {
      endpoint: SyncNearbyEndpoint;
      type: 'connected';
    }
  | {
      type: 'automaticConnectingStarted';
    }
  | {
      progress: SyncTransferProgress;
      type: 'transferUpdated';
    }
  | {
      peerEndpointName: string | null;
      review: SyncMergeReviewSummary;
      type: 'reviewReady';
    }
  | {
      type: 'prepareConfirmed';
    }
  | {
      type: 'peerPrepareConfirmed';
    }
  | {
      type: 'commitStarted';
    }
  | {
      review: SyncMergeReviewSummary;
      type: 'commitSucceeded';
    }
  | {
      code: string;
      message: string;
      type: 'sessionFailed';
    }
  | {
      type: 'sessionReset';
    };

const defaultAvailability: SyncTransportAvailability = {
  isReady: false,
  isSupported: false,
  playServicesStatus: null,
  reason: 'module-unavailable',
};

const defaultPermissions: SyncPermissionsState = {
  allGranted: false,
  deniedPermissions: [],
  requiredPermissions: [],
  results: {},
};

const defaultTransferProgress: SyncTransferProgress = {
  bytesTransferred: null,
  payloadId: null,
  status: 'idle',
  totalBytes: null,
};

const defaultNfcAvailability: NfcBootstrapAvailability = {
  hasAdapter: false,
  isEnabled: false,
  isReady: false,
  reason: 'module-unavailable',
  supportsHce: false,
  supportsReaderMode: false,
};

const defaultNfcBootstrap: SyncNfcBootstrapState = {
  attemptId: null,
  failureReason: null,
  message: null,
  phase: 'idle',
  role: null,
};

export function createInitialSyncSessionState(): SyncSessionState {
  return {
    authToken: null,
    availability: defaultAvailability,
    connectedEndpoint: null,
    discoveredEndpoints: [],
    errorCode: null,
    errorMessage: null,
    isAwaitingPeerPrepare: false,
    localPrepareConfirmed: false,
    nfcAvailability: defaultNfcAvailability,
    nfcBootstrap: defaultNfcBootstrap,
    permissions: defaultPermissions,
    phase: 'idle',
    review: null,
    role: null,
    sessionId: null,
    sessionLabel: null,
    transferProgress: defaultTransferProgress,
  };
}

function resetSessionProgress(
  state: SyncSessionState,
  overrides: Partial<SyncSessionState> = {},
): SyncSessionState {
  return {
    ...state,
    authToken: null,
    connectedEndpoint: null,
    discoveredEndpoints: [],
    errorCode: null,
    errorMessage: null,
    isAwaitingPeerPrepare: false,
    localPrepareConfirmed: false,
    nfcBootstrap: defaultNfcBootstrap,
    phase: 'idle',
    review: null,
    role: null,
    sessionId: null,
    sessionLabel: null,
    transferProgress: defaultTransferProgress,
    ...overrides,
  };
}

export function reduceSyncSessionState(
  state: SyncSessionState,
  action: SyncSessionAction,
): SyncSessionState {
  switch (action.type) {
    case 'availabilityUpdated':
      return {
        ...state,
        availability: action.availability,
      };
    case 'permissionsUpdated':
      return {
        ...state,
        permissions: action.permissions,
      };
    case 'nfcAvailabilityUpdated':
      return {
        ...state,
        nfcAvailability: action.availability,
      };
    case 'nfcBootstrapStateChanged':
      return {
        ...state,
        errorCode:
          action.nfcBootstrap.phase === 'error'
            ? action.nfcBootstrap.failureReason
            : state.errorCode,
        errorMessage:
          action.nfcBootstrap.phase === 'error'
            ? action.nfcBootstrap.message
            : state.errorMessage,
        nfcBootstrap: {
          attemptId: action.nfcBootstrap.attemptId,
          failureReason: action.nfcBootstrap.failureReason,
          message: action.nfcBootstrap.message,
          phase: action.nfcBootstrap.phase,
          role: action.nfcBootstrap.role,
        },
        phase:
          action.nfcBootstrap.phase === 'error'
            ? 'error'
            : action.nfcBootstrap.phase === 'completed'
              ? state.phase
              : 'bootstrapping',
      };
    case 'sessionStarted':
      return {
        ...state,
        authToken: null,
        connectedEndpoint: null,
        discoveredEndpoints: [],
        errorCode: null,
        errorMessage: null,
        isAwaitingPeerPrepare: false,
        localPrepareConfirmed: false,
        nfcBootstrap: defaultNfcBootstrap,
        phase: action.role === 'host' ? 'hosting' : 'discovering',
        review: null,
        role: action.role,
        sessionId: action.sessionId,
        sessionLabel: action.sessionLabel,
        transferProgress: defaultTransferProgress,
      };
    case 'discoveryUpdated':
      return {
        ...state,
        discoveredEndpoints: action.endpoints,
      };
    case 'pairingStarted':
      if (
        state.phase === 'pairing' &&
        state.authToken &&
        state.connectedEndpoint?.endpointId === action.endpoint.endpointId
      ) {
        return {
          ...state,
          connectedEndpoint: action.endpoint,
        };
      }

      return {
        ...state,
        authToken: null,
        connectedEndpoint: action.endpoint,
        errorCode: null,
        errorMessage: null,
        phase: 'connecting',
      };
    case 'authTokenReady':
      return {
        ...state,
        authToken: action.authToken,
        connectedEndpoint: action.endpoint,
        errorCode: null,
        errorMessage: null,
        phase: 'pairing',
      };
    case 'connected':
      return {
        ...state,
        connectedEndpoint: action.endpoint,
        errorCode: null,
        errorMessage: null,
        phase: 'transferring',
      };
    case 'automaticConnectingStarted':
      return {
        ...state,
        authToken: null,
        errorCode: null,
        errorMessage: null,
        phase: 'connecting',
      };
    case 'transferUpdated':
      return {
        ...state,
        transferProgress: action.progress,
      };
    case 'reviewReady':
      return {
        ...state,
        errorCode: null,
        errorMessage: null,
        isAwaitingPeerPrepare: false,
        phase: 'review',
        review: {
          ...action.review,
          peerEndpointName: action.peerEndpointName,
        },
        transferProgress: {
          ...state.transferProgress,
          status: 'success',
        },
      };
    case 'prepareConfirmed':
      return {
        ...state,
        isAwaitingPeerPrepare: true,
        localPrepareConfirmed: true,
      };
    case 'peerPrepareConfirmed':
      return {
        ...state,
        isAwaitingPeerPrepare: state.localPrepareConfirmed,
      };
    case 'commitStarted':
      return {
        ...state,
        phase: 'committing',
      };
    case 'commitSucceeded':
      return {
        ...state,
        errorCode: null,
        errorMessage: null,
        isAwaitingPeerPrepare: false,
        phase: 'success',
        review: {
          ...action.review,
          peerEndpointName: state.connectedEndpoint?.endpointName ?? null,
        },
      };
    case 'sessionFailed':
      return {
        ...state,
        errorCode: action.code,
        errorMessage: action.message,
        isAwaitingPeerPrepare: false,
        nfcBootstrap: {
          ...state.nfcBootstrap,
          failureReason: action.code,
          message: action.message,
          phase:
            state.phase === 'bootstrapping'
              ? 'error'
              : state.nfcBootstrap.phase,
        },
        phase: 'error',
      };
    case 'sessionReset':
      return resetSessionProgress(state, {
        availability: state.availability,
        nfcAvailability: state.nfcAvailability,
        permissions: state.permissions,
      });
  }
}

export function buildSyncSessionLogDetails(
  state: SyncSessionState,
  details: {
    bundleHash?: string | null;
    payloadId?: string | null;
  } = {},
) {
  return buildSyncLoggerContext({
    bundleHash: details.bundleHash,
    endpointId: state.connectedEndpoint?.endpointId ?? null,
    payloadId: details.payloadId ?? null,
    phase: state.phase,
    sessionId: state.sessionId,
  });
}

export function buildSyncSessionSummary(bundle: SyncBundle) {
  return {
    bundleHash: bundle.bundleHash,
    childReconciliationCount: bundle.childReconciliations.length,
    commonBaseHash: bundle.commonBaseHash,
    mergedChildCount: Object.keys(bundle.mergedHead.childrenById).length,
    mergedHeadSyncHash: bundle.mergedHeadSyncHash,
    mode: bundle.mode,
  } satisfies SyncMergeReviewSummary;
}
