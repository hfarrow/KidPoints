import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Text } from 'react-native';
import type { NfcBootstrapAvailability } from '../../../src/features/sync/nfcSyncBridge';
import {
  createBootstrapSessionLabel,
  createHelloEnvelope,
  serializeSyncEnvelope,
} from '../../../src/features/sync/syncProtocol';
import { useNearbySyncSession } from '../../../src/features/sync/useNearbySyncSession';
import {
  createInitialSharedDocument,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

const listeners = {
  authTokenReady: null as ((value: unknown) => void) | null,
  connectionRequested: null as ((value: unknown) => void) | null,
  connectionStateChanged: null as ((value: unknown) => void) | null,
  discoveryUpdated: null as ((value: unknown) => void) | null,
  envelopeReceived: null as ((value: unknown) => void) | null,
  nfcBootstrapCompleted: null as ((value: unknown) => void) | null,
  nfcBootstrapStateChanged: null as ((value: unknown) => void) | null,
  payloadProgress: null as ((value: unknown) => void) | null,
};

const readyAvailability = {
  isReady: true,
  isSupported: true,
  playServicesStatus: 0,
  reason: 'ready' as const,
};

const readyNfcAvailability: NfcBootstrapAvailability = {
  hasAdapter: true,
  isEnabled: true,
  isReady: true,
  reason: 'ready' as const,
  supportsHce: true,
  supportsReaderMode: true,
};

const grantedPermissions = {
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

const mockAcceptConnection = jest.fn<Promise<void>, [string]>(async () => {});
const mockBeginNfcBootstrap = jest.fn(async () => undefined);
const mockGetNfcBootstrapAvailability = jest.fn(
  async () => readyNfcAvailability,
);
const mockIsAvailable = jest.fn(async () => readyAvailability);
const mockRequestConnection = jest.fn(async () => undefined);
const mockRequestPermissions = jest.fn(async () => grantedPermissions);
const mockSendEnvelope = jest.fn(async () => 'payload-1');
const mockStartDiscovery = jest.fn(async () => undefined);
const mockStartHosting = jest.fn(async () => undefined);

const mockRuntime = {
  acceptConnection: mockAcceptConnection,
  addAuthTokenReadyListener: jest.fn((listener) => {
    listeners.authTokenReady = listener;
    return { remove: jest.fn() };
  }),
  addAvailabilityChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  addConnectionRequestedListener: jest.fn((listener) => {
    listeners.connectionRequested = listener;
    return { remove: jest.fn() };
  }),
  addConnectionStateChangedListener: jest.fn((listener) => {
    listeners.connectionStateChanged = listener;
    return { remove: jest.fn() };
  }),
  addDiscoveryUpdatedListener: jest.fn((listener) => {
    listeners.discoveryUpdated = listener;
    return { remove: jest.fn() };
  }),
  addEnvelopeReceivedListener: jest.fn((listener) => {
    listeners.envelopeReceived = listener;
    return { remove: jest.fn() };
  }),
  addErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  addNearbySyncLogListener: jest.fn(() => ({ remove: jest.fn() })),
  addNfcBootstrapCompletedListener: jest.fn((listener) => {
    listeners.nfcBootstrapCompleted = listener;
    return { remove: jest.fn() };
  }),
  addNfcBootstrapStateChangedListener: jest.fn((listener) => {
    listeners.nfcBootstrapStateChanged = listener;
    return { remove: jest.fn() };
  }),
  addNfcSyncLogListener: jest.fn(() => ({ remove: jest.fn() })),
  addPayloadProgressListener: jest.fn((listener) => {
    listeners.payloadProgress = listener;
    return { remove: jest.fn() };
  }),
  beginNfcBootstrap: mockBeginNfcBootstrap,
  cancelNfcBootstrap: jest.fn(async () => undefined),
  disconnect: jest.fn(async () => undefined),
  getBufferedNearbySyncLogs: jest.fn(() => []),
  getBufferedNfcSyncLogs: jest.fn(() => []),
  getNfcBootstrapAvailability: mockGetNfcBootstrapAvailability,
  isAvailable: mockIsAvailable,
  rejectConnection: jest.fn(async () => undefined),
  requestConnection: mockRequestConnection,
  requestPermissions: mockRequestPermissions,
  sendEnvelope: mockSendEnvelope,
  sendFile: jest.fn(async () => 'file-payload-1'),
  startDiscovery: mockStartDiscovery,
  startHosting: mockStartHosting,
  stopAll: jest.fn(async () => undefined),
};

jest.mock('../../../src/logging/logger', () => {
  const actualLoggerModule = jest.requireActual('../../../src/logging/logger');

  return {
    ...actualLoggerModule,
    createModuleLogger: jest.fn(() => ({
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      namespace: 'nearby-sync-session-test',
      temp: jest.fn(),
      warn: jest.fn(),
    })),
    logForwardedNativeEntry: jest.fn(),
  };
});

jest.mock('../../../src/features/sync/syncRuntimeContext', () => ({
  useSyncRuntime: () => mockRuntime,
}));

jest.mock('../../../src/features/sync/syncFileTransfer', () => ({
  exportSyncProjectionToFile: jest.fn(() => ({
    exportId: 'projection-export-1',
    fileName: 'projection-export-1.json',
    fileUri: 'file:///projection-export-1.json',
    projection: null,
    sizeBytes: 1234,
  })),
  loadSyncProjectionFromFile: jest.fn(() => ({
    error: 'The received sync history file could not be read.',
    ok: false,
  })),
}));

function SessionProbe() {
  const { startSyncFlow, state } = useNearbySyncSession();

  return (
    <>
      <Text testID="phase">{state.phase}</Text>
      <Text testID="error-message">{state.errorMessage ?? 'none'}</Text>
      <Text
        onPress={() => {
          void startSyncFlow();
        }}
      >
        Start Sync
      </Text>
    </>
  );
}

function renderSessionProbe() {
  return render(
    <SharedStoreProvider
      initialDocument={createInitialSharedDocument({
        deviceId: 'sync-session-test-device',
      })}
      storage={createMemoryStorage()}
    >
      <SessionProbe />
    </SharedStoreProvider>,
  );
}

describe('useNearbySyncSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listeners.authTokenReady = null;
    listeners.connectionRequested = null;
    listeners.connectionStateChanged = null;
    listeners.discoveryUpdated = null;
    listeners.envelopeReceived = null;
    listeners.nfcBootstrapCompleted = null;
    listeners.nfcBootstrapStateChanged = null;
    listeners.payloadProgress = null;
    mockAcceptConnection.mockResolvedValue(undefined);
    mockBeginNfcBootstrap.mockResolvedValue(undefined);
    mockGetNfcBootstrapAvailability.mockResolvedValue(readyNfcAvailability);
    mockIsAvailable.mockResolvedValue(readyAvailability);
    mockRequestConnection.mockResolvedValue(undefined);
    mockRequestPermissions.mockResolvedValue(grantedPermissions);
    mockSendEnvelope.mockResolvedValue('payload-1');
    mockStartDiscovery.mockResolvedValue(undefined);
    mockStartHosting.mockResolvedValue(undefined);
  });

  it('enters an error state when NFC bootstrap is unavailable', async () => {
    mockGetNfcBootstrapAvailability.mockResolvedValue({
      ...readyNfcAvailability,
      isEnabled: false,
      isReady: false,
      reason: 'nfc-disabled',
    });

    renderSessionProbe();
    fireEvent.press(screen.getByText('Start Sync'));

    await waitFor(() =>
      expect(screen.getByTestId('phase').props.children).toBe('error'),
    );
    expect(screen.getByTestId('error-message').props.children).toBe(
      'Turn on NFC on both phones before starting sync.',
    );
    expect(mockBeginNfcBootstrap).not.toHaveBeenCalled();
  });

  it('starts discovery automatically after a successful NFC bootstrap as the joiner', async () => {
    renderSessionProbe();
    fireEvent.press(screen.getByText('Start Sync'));

    await waitFor(() => expect(mockBeginNfcBootstrap).toHaveBeenCalled());

    await act(async () => {
      listeners.nfcBootstrapCompleted?.({
        attemptId: 'attempt-1',
        bootstrapToken: 'bootstrap-token-123',
        peerDeviceHash: 'peer-hash',
        role: 'join',
      });
    });

    await waitFor(() => expect(mockStartDiscovery).toHaveBeenCalled());

    await act(async () => {
      listeners.discoveryUpdated?.({
        endpoints: [
          {
            endpointId: 'endpoint-1',
            endpointName: createBootstrapSessionLabel('bootstrap-token-123'),
          },
        ],
      });
    });

    await waitFor(() =>
      expect(mockRequestConnection).toHaveBeenCalledWith('endpoint-1'),
    );
  });

  it('auto-accepts the same pending connection only once in automatic mode', async () => {
    renderSessionProbe();
    fireEvent.press(screen.getByText('Start Sync'));

    await act(async () => {
      listeners.nfcBootstrapCompleted?.({
        attemptId: 'attempt-2',
        bootstrapToken: 'bootstrap-token-456',
        peerDeviceHash: 'peer-hash',
        role: 'host',
      });
    });

    await waitFor(() => expect(mockStartHosting).toHaveBeenCalled());

    await act(async () => {
      listeners.authTokenReady?.({
        authToken: 'AUTO1',
        endpointId: 'endpoint-1',
        endpointName: 'Parent-SIM',
        isIncomingConnection: true,
      });
      listeners.authTokenReady?.({
        authToken: 'AUTO1',
        endpointId: 'endpoint-1',
        endpointName: 'Parent-SIM',
        isIncomingConnection: true,
      });
    });

    await waitFor(() => expect(mockAcceptConnection).toHaveBeenCalledTimes(1));
  });

  it('rejects a nearby link whose first HELLO does not match the NFC-bound session', async () => {
    renderSessionProbe();
    fireEvent.press(screen.getByText('Start Sync'));

    await act(async () => {
      listeners.nfcBootstrapCompleted?.({
        attemptId: 'attempt-3',
        bootstrapToken: 'bootstrap-token-789',
        peerDeviceHash: 'peer-hash',
        role: 'host',
      });
    });

    await waitFor(() => expect(mockStartHosting).toHaveBeenCalled());

    await act(async () => {
      listeners.authTokenReady?.({
        authToken: 'AUTO2',
        endpointId: 'endpoint-2',
        endpointName: 'Parent-SIM',
        isIncomingConnection: true,
      });
    });
    await waitFor(() =>
      expect(mockAcceptConnection).toHaveBeenCalledWith('endpoint-2'),
    );

    await act(async () => {
      listeners.connectionStateChanged?.({
        endpointId: 'endpoint-2',
        endpointName: 'Parent-SIM',
        reason: null,
        state: 'connected',
      });
    });
    await waitFor(() => expect(mockSendEnvelope).toHaveBeenCalled());

    await act(async () => {
      listeners.envelopeReceived?.({
        endpointId: 'endpoint-2',
        envelopeJson: serializeSyncEnvelope(
          createHelloEnvelope({
            bootstrapToken: 'bootstrap-token-789',
            deviceInstanceId: 'remote-device',
            sessionId: 'wrong-session-id',
          }),
        ),
        payloadId: 'payload-remote-1',
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId('phase').props.children).toBe('error'),
    );
    expect(screen.getByTestId('error-message').props.children).toBe(
      'The nearby connection used a different sync session than the NFC bootstrap expected.',
    );
  });
});
