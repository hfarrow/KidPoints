import {
  createHelloEnvelope,
  createMergeResultEnvelope,
  parseSyncEnvelope,
  truncateHashForLog,
} from '../../../src/features/sync/syncProtocol';
import {
  buildSyncSessionLogDetails,
  createInitialSyncSessionState,
  reduceSyncSessionState,
} from '../../../src/features/sync/syncSessionMachine';
import {
  createInitialSharedDocument,
  createSharedStore,
} from '../../../src/state/sharedStore';
import { deriveSyncProjection } from '../../../src/state/sharedSync';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

function createFixtureBundle() {
  return {
    bundleHash: 'sync-bundle-1234567890',
    childReconciliations: [],
    commonBaseHash: 'sync-base-1234567890',
    mergedHead: {
      activeChildIds: [],
      archivedChildIds: [],
      childrenById: {},
    },
    mergedHeadSyncHash: 'sync-head-1234567890',
    mode: 'bootstrap' as const,
    participantHeadHashes: ['sync-left', 'sync-right'],
    participantHeadSyncHashes: ['sync-left-head', 'sync-right-head'],
    syncSchemaVersion: 1 as const,
  };
}

describe('syncProtocol', () => {
  it('parses a HELLO envelope with the expected protocol version', () => {
    const envelope = createHelloEnvelope({
      bootstrapToken: 'bootstrap-token-1',
      deviceInstanceId: 'device-sync-protocol',
      sessionId: 'sync-session-1',
    });

    expect(parseSyncEnvelope(JSON.stringify(envelope))).toEqual({
      envelope,
      ok: true,
    });
  });

  it('rejects envelopes with missing shared fields', () => {
    expect(parseSyncEnvelope(JSON.stringify({ type: 'HELLO' }))).toEqual({
      code: 'invalid-shape',
      message: 'The sync envelope payload was missing shared fields.',
      ok: false,
    });
  });

  it('creates merge result envelopes from shared bundles', () => {
    const bundle = createFixtureBundle();

    expect(
      createMergeResultEnvelope({
        bundle,
        sessionId: 'sync-session-merge',
      }),
    ).toMatchObject({
      bundleHash: bundle.bundleHash,
      mergedHeadSyncHash: bundle.mergedHeadSyncHash,
      mode: 'bootstrap',
      sessionId: 'sync-session-merge',
      type: 'MERGE_RESULT',
    });
  });

  it('truncates hashes for log-safe correlation fields', () => {
    expect(truncateHashForLog('sync-bundle-1234567890')).toBe('sync-bundle-12');
    expect(truncateHashForLog(null)).toBeNull();
  });
});

describe('syncSessionMachine', () => {
  it('moves from hosting to pairing to review with correlated log details', () => {
    const hosted = reduceSyncSessionState(createInitialSyncSessionState(), {
      role: 'host',
      sessionId: 'sync-session-state',
      sessionLabel: 'KidPoints-AB12',
      type: 'sessionStarted',
    });
    const pairing = reduceSyncSessionState(hosted, {
      authToken: '1234',
      endpoint: {
        endpointId: 'endpoint-1',
        endpointName: 'KidPoints-AB12',
      },
      type: 'authTokenReady',
    });
    const review = reduceSyncSessionState(pairing, {
      peerEndpointName: 'KidPoints-AB12',
      review: {
        bundleHash: 'sync-bundle-1234567890',
        childReconciliationCount: 2,
        commonBaseHash: 'sync-base-1234567890',
        mergedChildCount: 1,
        mergedHeadSyncHash: 'sync-head-1234567890',
        mode: 'merged',
      },
      type: 'reviewReady',
    });

    expect(hosted.phase).toBe('hosting');
    expect(pairing.phase).toBe('pairing');
    expect(review.phase).toBe('review');
    expect(
      buildSyncSessionLogDetails(review, {
        bundleHash: review.review?.bundleHash,
        payloadId: '42',
      }),
    ).toMatchObject({
      bundleHashPrefix: 'sync-bundle-12',
      endpointId: 'endpoint-1',
      payloadId: '42',
      phase: 'review',
      sessionId: 'sync-session-state',
    });
  });

  it('captures an error state without clearing transport context', () => {
    const activeState = reduceSyncSessionState(
      createInitialSyncSessionState(),
      {
        role: 'join',
        sessionId: 'sync-session-error',
        sessionLabel: null,
        type: 'sessionStarted',
      },
    );
    const errorState = reduceSyncSessionState(activeState, {
      code: 'connection-disconnected',
      message: 'The nearby sync connection was lost.',
      type: 'sessionFailed',
    });

    expect(errorState.phase).toBe('error');
    expect(errorState.errorCode).toBe('connection-disconnected');
    expect(errorState.sessionId).toBe('sync-session-error');
  });

  it('keeps pairing state when a duplicate pairingStarted action arrives for the same endpoint', () => {
    const pairingState = reduceSyncSessionState(
      createInitialSyncSessionState(),
      {
        authToken: 'token-1234',
        endpoint: {
          endpointId: 'endpoint-1',
          endpointName: 'KidPoints-AB12',
        },
        type: 'authTokenReady',
      },
    );

    const nextState = reduceSyncSessionState(pairingState, {
      endpoint: {
        endpointId: 'endpoint-1',
        endpointName: 'KidPoints-AB12',
      },
      type: 'pairingStarted',
    });

    expect(nextState.phase).toBe('pairing');
    expect(nextState.authToken).toBe('token-1234');
    expect(nextState.connectedEndpoint?.endpointId).toBe('endpoint-1');
  });
});

describe('sync projection fixture', () => {
  it('derives a sync projection summary from the current shared document', () => {
    const store = createSharedStore({
      initialDocument: createInitialSharedDocument({
        deviceId: 'device-sync-projection',
      }),
      storage: createMemoryStorage(),
    });

    expect(store.getState().addChild('Ava').ok).toBe(true);

    const projection = deriveSyncProjection(store.getState().document);

    expect(projection.entries).toHaveLength(1);
    expect(projection.head.activeChildIds).toHaveLength(1);
  });
});
