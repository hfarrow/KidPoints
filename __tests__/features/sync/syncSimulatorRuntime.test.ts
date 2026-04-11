import {
  createHelloEnvelope,
  serializeSyncEnvelope,
} from '../../../src/features/sync/syncProtocol';
import { createSimulatorNearbySyncRuntime } from '../../../src/features/sync/syncSimulatorRuntime';
import {
  createInitialSharedDocument,
  createSharedStore,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const mockFileContents = new Map<string, string>();

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;

    constructor(baseOrUri: string, fileName?: string) {
      this.uri =
        fileName == null
          ? baseOrUri
          : `${baseOrUri.replace(/\/$/, '')}/${fileName}`;
    }

    textSync() {
      return mockFileContents.get(this.uri) ?? '';
    }

    write(contents: string) {
      mockFileContents.set(this.uri, contents);
    }
  }

  return {
    File: MockFile,
    Paths: {
      cache: 'file:///cache',
    },
  };
});

describe('syncSimulatorRuntime', () => {
  beforeEach(() => {
    mockFileContents.clear();
  });

  it('switches remote endpoint identity when the mode changes', () => {
    const simulator = createSimulatorNearbySyncRuntime({
      getLocalDocument: () =>
        createInitialSharedDocument({ deviceId: 'local' }),
    });

    expect(simulator.controller.getSnapshot().remoteEndpoint.endpointName).toBe(
      'Parent-SIMJ',
    );

    simulator.controller.setMode('joiner');

    expect(simulator.controller.getSnapshot().remoteEndpoint.endpointName).toBe(
      'KidPoints-SIMH',
    );
  });

  it('applies availability and permission failure scenarios', async () => {
    const simulator = createSimulatorNearbySyncRuntime({
      getLocalDocument: () =>
        createInitialSharedDocument({ deviceId: 'local' }),
    });

    simulator.controller.applyScenario('availability-unavailable');
    await expect(simulator.runtime.isAvailable()).resolves.toMatchObject({
      isReady: false,
      reason: 'module-unavailable',
    });

    simulator.controller.applyScenario('permissions-denied');
    await expect(simulator.runtime.requestPermissions()).resolves.toMatchObject(
      {
        allGranted: false,
        deniedPermissions: ['android.permission.BLUETOOTH_CONNECT'],
      },
    );
  });

  it('tracks fixture strategy and shared-base selection in controller state', () => {
    const localDocument = createInitialSharedDocument({ deviceId: 'local' });
    const simulator = createSimulatorNearbySyncRuntime({
      getLocalDocument: () => localDocument,
    });

    simulator.controller.setFixtureStrategy('shared-base');
    simulator.controller.setCommonBaseTransactionId('transaction-123');

    expect(simulator.controller.getSnapshot()).toMatchObject({
      commonBaseTransactionId: 'transaction-123',
      fixtureStrategyId: 'shared-base',
    });
  });

  it('emits connecting/auth-token events and auto-responds to HELLO', async () => {
    const simulator = createSimulatorNearbySyncRuntime({
      getLocalDocument: () =>
        createInitialSharedDocument({ deviceId: 'local' }),
    });
    const connectionStates: string[] = [];
    const authTokens: string[] = [];
    const envelopes: string[] = [];

    simulator.runtime.addConnectionStateChangedListener((event) => {
      connectionStates.push(event.state);
    });
    simulator.runtime.addAuthTokenReadyListener((event) => {
      authTokens.push(event.authToken);
    });
    simulator.runtime.addEnvelopeReceivedListener((event) => {
      envelopes.push(event.envelopeJson);
    });

    await simulator.runtime.requestConnection('sim-host-endpoint');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(connectionStates).toContain('connecting');
    expect(authTokens).toContain('SIM42');

    await simulator.runtime.sendEnvelope({
      endpointId: 'sim-host-endpoint',
      envelopeJson: serializeSyncEnvelope(
        createHelloEnvelope({
          bootstrapToken: 'sim-bootstrap-test',
          deviceInstanceId: 'local-device',
          sessionId: 'local-session',
        }),
      ),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      envelopes.some((envelopeJson) => envelopeJson.includes('"HELLO"')),
    ).toBe(true);
  });

  it('reuses the prepared right-bootstrap bundle after local preview state changes', () => {
    let localDocument = createInitialSharedDocument({
      deviceId: 'local-empty',
    });
    const simulator = createSimulatorNearbySyncRuntime({
      getLocalDocument: () => localDocument,
    });
    const envelopeJsons: string[] = [];
    const errors: string[] = [];

    simulator.controller.setFixtureStrategy('bootstrap-right-to-left');
    simulator.runtime.addEnvelopeReceivedListener((event) => {
      envelopeJsons.push(event.envelopeJson);
    });
    simulator.runtime.addErrorListener((event) => {
      errors.push(event.code);
    });

    simulator.controller.emitRemoteMergeResult();

    const unrelatedStore = createSharedStore({
      storage: createMemoryStorage(),
    });

    unrelatedStore.getState().addChild('Maya');
    localDocument = unrelatedStore.getState().document;

    simulator.controller.emitRemoteCommitAck();

    expect(errors).toEqual([]);
    expect(
      envelopeJsons.some((envelopeJson) =>
        envelopeJson.includes('"COMMIT_ACK"'),
      ),
    ).toBe(true);
  });
});
