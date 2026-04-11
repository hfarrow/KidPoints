import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Text } from 'react-native';
import { useNearbySyncSession } from '../../../src/features/sync/useNearbySyncSession';
import {
  createInitialSharedDocument,
  SharedStoreProvider,
} from '../../../src/state/sharedStore';
import {
  deriveSyncProjection,
  prepareSyncDeviceBundle,
} from '../../../src/state/sharedSync';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

let mockConnectionRequestedListener: ((value: unknown) => void) | null = null;
let mockAuthTokenReadyListener: ((value: unknown) => void) | null = null;
let mockConnectionStateChangedListener: ((value: unknown) => void) | null =
  null;
let mockEnvelopeReceivedListener: ((value: unknown) => void) | null = null;
let mockPayloadProgressListener: ((value: unknown) => void) | null = null;
const mockAcceptConnection = jest.fn<Promise<void>, [string]>(async () => {});
const mockIsAvailable = jest.fn(async () => ({
  isReady: true,
  isSupported: true,
  playServicesStatus: 0,
  reason: 'ready',
}));
const mockRequestConnection = jest.fn(async () => undefined);
const mockRequestPermissions = jest.fn(async () => ({
  allGranted: true,
  deniedPermissions: [],
  requiredPermissions: [
    'android.permission.BLUETOOTH_ADVERTISE',
    'android.permission.BLUETOOTH_CONNECT',
    'android.permission.BLUETOOTH_SCAN',
    'android.permission.NEARBY_WIFI_DEVICES',
  ],
  results: {
    'android.permission.BLUETOOTH_ADVERTISE': 'granted',
    'android.permission.BLUETOOTH_CONNECT': 'granted',
    'android.permission.BLUETOOTH_SCAN': 'granted',
    'android.permission.NEARBY_WIFI_DEVICES': 'granted',
  },
}));
const mockSendFile = jest.fn(async () => '2');
const mockStartDiscovery = jest.fn(async () => undefined);
const mockStartHosting = jest.fn(async () => undefined);
const mockStopAll = jest.fn(async () => undefined);
const mockRuntime = {
  acceptConnection: mockAcceptConnection,
  addAuthTokenReadyListener: jest.fn((listener) => {
    mockAuthTokenReadyListener = listener;
    return { remove: jest.fn() };
  }),
  addAvailabilityChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  addConnectionRequestedListener: jest.fn((listener) => {
    mockConnectionRequestedListener = listener;
    return { remove: jest.fn() };
  }),
  addConnectionStateChangedListener: jest.fn((listener) => {
    mockConnectionStateChangedListener = listener;
    return { remove: jest.fn() };
  }),
  addDiscoveryUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  addEnvelopeReceivedListener: jest.fn((listener) => {
    mockEnvelopeReceivedListener = listener;
    return { remove: jest.fn() };
  }),
  addErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  addNearbySyncLogListener: jest.fn(() => ({ remove: jest.fn() })),
  addPayloadProgressListener: jest.fn((listener) => {
    mockPayloadProgressListener = listener;
    return { remove: jest.fn() };
  }),
  disconnect: jest.fn(async () => undefined),
  getBufferedNearbySyncLogs: jest.fn(() => []),
  isAvailable: mockIsAvailable,
  rejectConnection: jest.fn(async () => undefined),
  requestConnection: mockRequestConnection,
  requestPermissions: mockRequestPermissions,
  sendEnvelope: jest.fn(async () => '1'),
  sendFile: mockSendFile,
  startDiscovery: mockStartDiscovery,
  startHosting: mockStartHosting,
  stopAll: mockStopAll,
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

const {
  exportSyncProjectionToFile: mockExportSyncProjectionToFile,
  loadSyncProjectionFromFile: mockLoadSyncProjectionFromFile,
} = jest.requireMock('../../../src/features/sync/syncFileTransfer') as {
  exportSyncProjectionToFile: jest.Mock;
  loadSyncProjectionFromFile: jest.Mock;
};

function SessionProbe() {
  const {
    acceptPairingCode,
    confirmMergeAndPrepareCommit,
    connectToEndpoint,
    startHostFlow,
    startJoinFlow,
    state,
  } = useNearbySyncSession();

  return (
    <>
      <Text testID="phase">{state.phase}</Text>
      <Text testID="auth-token">{state.authToken ?? 'none'}</Text>
      <Text testID="error-message">{state.errorMessage ?? 'none'}</Text>
      <Text
        onPress={() => {
          void startHostFlow();
        }}
      >
        Start Host
      </Text>
      <Text
        onPress={() => {
          void startJoinFlow();
        }}
      >
        Start Join
      </Text>
      <Text
        onPress={() => {
          void acceptPairingCode();
        }}
      >
        Accept Pairing
      </Text>
      <Text
        onPress={() => {
          void confirmMergeAndPrepareCommit();
        }}
      >
        Confirm Sync
      </Text>
      <Text
        onPress={() => {
          void connectToEndpoint({
            endpointId: 'endpoint-1',
            endpointName: 'KidPoints-CZE4',
          });
        }}
      >
        Connect Endpoint
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
    mockAuthTokenReadyListener = null;
    mockConnectionRequestedListener = null;
    mockConnectionStateChangedListener = null;
    mockEnvelopeReceivedListener = null;
    mockPayloadProgressListener = null;
    mockIsAvailable.mockResolvedValue({
      isReady: true,
      isSupported: true,
      playServicesStatus: 0,
      reason: 'ready',
    });
    mockRequestPermissions.mockResolvedValue({
      allGranted: true,
      deniedPermissions: [],
      requiredPermissions: [
        'android.permission.BLUETOOTH_ADVERTISE',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.NEARBY_WIFI_DEVICES',
      ],
      results: {
        'android.permission.BLUETOOTH_ADVERTISE': 'granted',
        'android.permission.BLUETOOTH_CONNECT': 'granted',
        'android.permission.BLUETOOTH_SCAN': 'granted',
        'android.permission.NEARBY_WIFI_DEVICES': 'granted',
      },
    });
    mockExportSyncProjectionToFile.mockReturnValue({
      exportId: 'projection-export-1',
      fileName: 'projection-export-1.json',
      fileUri: 'file:///projection-export-1.json',
      projection: null,
      sizeBytes: 1234,
    });
    mockLoadSyncProjectionFromFile.mockReturnValue({
      error: 'The received sync history file could not be read.',
      ok: false,
    });
    mockAcceptConnection.mockResolvedValue(undefined);
    mockRequestConnection.mockResolvedValue(undefined);
    mockSendFile.mockResolvedValue('2');
    mockStartDiscovery.mockResolvedValue(undefined);
    mockStartHosting.mockResolvedValue(undefined);
    mockStopAll.mockResolvedValue(undefined);
  });

  it('moves to an error state when hosting startup fails', async () => {
    mockStartHosting.mockRejectedValueOnce(
      new Error('8038: MISSING_PERMISSION_BLUETOOTH_ADVERTISE'),
    );

    renderSessionProbe();

    await act(async () => {
      fireEvent.press(screen.getByText('Start Host'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('phase').props.children).toBe('error'),
    );
    expect(screen.getByTestId('error-message').props.children).toBe(
      'Nearby sync hosting could not start. Bluetooth advertise permission is missing on this device.',
    );
    expect(mockStopAll).toHaveBeenCalledTimes(1);
    expect(mockStartHosting).toHaveBeenCalledWith({
      localEndpointName: expect.stringMatching(/^Parent-/),
      sessionLabel: expect.stringMatching(/^KidPoints-/),
    });
  });

  it('moves to an error state when discovery startup fails because location is missing', async () => {
    mockStartDiscovery.mockRejectedValueOnce(
      new Error('8034: MISSING_PERMISSION_ACCESS_COARSE_LOCATION'),
    );

    renderSessionProbe();

    await act(async () => {
      fireEvent.press(screen.getByText('Start Join'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('phase').props.children).toBe('error'),
    );
    expect(screen.getByTestId('error-message').props.children).toBe(
      'Nearby sync discovery could not start. Nearby discovery location permission is missing on this device.',
    );
    expect(mockStopAll).toHaveBeenCalledTimes(1);
    expect(mockStartDiscovery).toHaveBeenCalledWith({
      localEndpointName: expect.stringMatching(/^Parent-/),
    });
  });

  it('keeps the pairing token visible when the native requested state arrives after auth token readiness', async () => {
    renderSessionProbe();

    await act(async () => {
      fireEvent.press(screen.getByText('Start Host'));
    });

    expect(screen.getByTestId('phase').props.children).toBe('hosting');

    await act(async () => {
      mockConnectionRequestedListener?.({
        endpointId: 'endpoint-1',
        endpointName: 'Parent-V9FZ',
      });
      mockAuthTokenReadyListener?.({
        authToken: 'ZVWTH',
        endpointId: 'endpoint-1',
        endpointName: 'Parent-V9FZ',
        isIncomingConnection: true,
      });
      mockConnectionStateChangedListener?.({
        endpointId: 'endpoint-1',
        endpointName: 'Parent-V9FZ',
        reason: null,
        state: 'requested',
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId('phase').props.children).toBe('pairing'),
    );
    expect(screen.getByTestId('auth-token').props.children).toBe('ZVWTH');
  });

  it('enters connecting immediately from endpoint selection without waiting for a native connecting event', async () => {
    renderSessionProbe();

    await act(async () => {
      fireEvent.press(screen.getByText('Start Join'));
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Connect Endpoint'));
    });

    expect(mockRequestConnection).toHaveBeenCalledWith('endpoint-1');
    expect(screen.getByTestId('phase').props.children).toBe('connecting');
  });

  it('keeps the pairing token visible when the native connecting state arrives after auth token readiness', async () => {
    renderSessionProbe();

    await act(async () => {
      fireEvent.press(screen.getByText('Start Join'));
    });

    expect(screen.getByTestId('phase').props.children).toBe('discovering');

    await act(async () => {
      mockConnectionRequestedListener?.({
        endpointId: 'endpoint-1',
        endpointName: 'KidPoints-CZE4',
      });
      mockAuthTokenReadyListener?.({
        authToken: 'K7T9_',
        endpointId: 'endpoint-1',
        endpointName: 'KidPoints-CZE4',
        isIncomingConnection: false,
      });
      mockConnectionStateChangedListener?.({
        endpointId: 'endpoint-1',
        endpointName: 'KidPoints-CZE4',
        reason: null,
        state: 'connecting',
      });
      mockConnectionStateChangedListener?.({
        endpointId: 'endpoint-1',
        endpointName: 'KidPoints-CZE4',
        reason: null,
        state: 'requested',
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId('phase').props.children).toBe('pairing'),
    );
    expect(screen.getByTestId('auth-token').props.children).toBe('K7T9_');
  });

  it('sends the projection file only once when both SYNC_REQUEST and SYNC_RESPONSE arrive', async () => {
    renderSessionProbe();

    await act(async () => {
      fireEvent.press(screen.getByText('Start Host'));
    });

    await act(async () => {
      mockConnectionStateChangedListener?.({
        endpointId: 'endpoint-1',
        endpointName: 'Parent-V9FZ',
        reason: null,
        state: 'connected',
      });
    });

    await act(async () => {
      mockEnvelopeReceivedListener?.({
        endpointId: 'endpoint-1',
        envelopeJson: JSON.stringify({
          entryCount: 0,
          headHash: 'sync-head-1',
          headSyncHash: 'sync-sync-head-1',
          isBootstrappable: true,
          protocolVersion: 1,
          sentAt: new Date().toISOString(),
          sessionId: 'remote-session-1',
          syncSchemaVersion: 1,
          type: 'SYNC_SUMMARY',
        }),
        payloadId: '11',
      });
      mockEnvelopeReceivedListener?.({
        endpointId: 'endpoint-1',
        envelopeJson: JSON.stringify({
          projectionRequested: true,
          protocolVersion: 1,
          sentAt: new Date().toISOString(),
          sessionId: 'remote-session-1',
          type: 'SYNC_REQUEST',
        }),
        payloadId: '12',
      });
      mockEnvelopeReceivedListener?.({
        endpointId: 'endpoint-1',
        envelopeJson: JSON.stringify({
          accepted: true,
          projectionOffered: true,
          protocolVersion: 1,
          reason: null,
          sentAt: new Date().toISOString(),
          sessionId: 'remote-session-1',
          type: 'SYNC_RESPONSE',
        }),
        payloadId: '13',
      });
    });

    await waitFor(() => expect(mockSendFile).toHaveBeenCalledTimes(1));
  });

  it('accepts the pairing code only once while the accept call is in flight', async () => {
    let resolveAcceptConnection: (() => void) | null = null;

    mockAcceptConnection.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAcceptConnection = () => {
            resolve();
          };
        }),
    );

    renderSessionProbe();

    await act(async () => {
      fireEvent.press(screen.getByText('Start Host'));
    });

    await act(async () => {
      mockConnectionRequestedListener?.({
        endpointId: 'endpoint-1',
        endpointName: 'Parent-V9FZ',
      });
      mockAuthTokenReadyListener?.({
        authToken: 'ZVWTH',
        endpointId: 'endpoint-1',
        endpointName: 'Parent-V9FZ',
        isIncomingConnection: true,
      });
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Accept Pairing'));
      fireEvent.press(screen.getByText('Accept Pairing'));
    });

    expect(mockAcceptConnection).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAcceptConnection?.();
    });
  });

  it('pairs a completed file payload with later history metadata', async () => {
    const remoteProjection = deriveSyncProjection(
      createInitialSharedDocument({
        deviceId: 'remote-sync-session-device',
      }),
    );

    mockLoadSyncProjectionFromFile.mockReturnValue({
      ok: true,
      projection: remoteProjection,
    });

    renderSessionProbe();

    await act(async () => {
      fireEvent.press(screen.getByText('Start Host'));
    });

    await act(async () => {
      mockConnectionStateChangedListener?.({
        endpointId: 'endpoint-1',
        endpointName: 'Parent-V9FZ',
        reason: null,
        state: 'connected',
      });
    });

    await act(async () => {
      mockEnvelopeReceivedListener?.({
        endpointId: 'endpoint-1',
        envelopeJson: JSON.stringify({
          entryCount: remoteProjection.entries.length,
          headHash: remoteProjection.headHash,
          headSyncHash: remoteProjection.headSyncHash,
          isBootstrappable: true,
          protocolVersion: 1,
          sentAt: new Date().toISOString(),
          sessionId: 'remote-session-1',
          syncSchemaVersion: remoteProjection.syncSchemaVersion,
          type: 'SYNC_SUMMARY',
        }),
        payloadId: '11',
      });
      mockPayloadProgressListener?.({
        bytesTransferred: 1593,
        endpointId: 'endpoint-1',
        fileUri: 'file:///incoming-projection.json',
        payloadId: 'payload-file-1',
        payloadKind: 'file',
        status: 'success',
        totalBytes: 1593,
      });
      mockEnvelopeReceivedListener?.({
        endpointId: 'endpoint-1',
        envelopeJson: JSON.stringify({
          entryCount: remoteProjection.entries.length,
          exportId: 'projection-export-remote',
          fileName: 'projection-export-remote.json',
          headHash: remoteProjection.headHash,
          headSyncHash: remoteProjection.headSyncHash,
          payloadId: 'payload-file-1',
          projectionScope: remoteProjection.scope,
          projectionSyncSchemaVersion: remoteProjection.syncSchemaVersion,
          protocolVersion: 1,
          sentAt: new Date().toISOString(),
          sessionId: 'remote-session-1',
          type: 'HISTORY_FILE_META',
        }),
        payloadId: '12',
      });
    });

    await waitFor(() =>
      expect(mockLoadSyncProjectionFromFile).toHaveBeenCalledWith(
        'file:///incoming-projection.json',
      ),
    );
  });

  it('stays successful when disconnect and canceled payload events arrive during intentional post-commit teardown', async () => {
    const localDocument = createInitialSharedDocument({
      deviceId: 'sync-session-test-device',
    });
    const remoteProjection = deriveSyncProjection(
      createInitialSharedDocument({
        deviceId: 'remote-sync-session-device',
      }),
    );
    const preparedBundle = prepareSyncDeviceBundle({
      localDocument,
      remoteProjection,
    });

    if (!preparedBundle.ok) {
      throw new Error('Expected prepared sync bundle fixture to be valid.');
    }

    mockLoadSyncProjectionFromFile.mockReturnValue({
      ok: true,
      projection: remoteProjection,
    });

    renderSessionProbe();

    await act(async () => {
      fireEvent.press(screen.getByText('Start Host'));
    });

    await act(async () => {
      mockConnectionStateChangedListener?.({
        endpointId: 'endpoint-1',
        endpointName: 'Parent-V9FZ',
        reason: null,
        state: 'connected',
      });
    });

    await act(async () => {
      mockEnvelopeReceivedListener?.({
        endpointId: 'endpoint-1',
        envelopeJson: JSON.stringify({
          entryCount: remoteProjection.entries.length,
          headHash: remoteProjection.headHash,
          headSyncHash: remoteProjection.headSyncHash,
          isBootstrappable: true,
          protocolVersion: 1,
          sentAt: new Date().toISOString(),
          sessionId: 'remote-session-1',
          syncSchemaVersion: remoteProjection.syncSchemaVersion,
          type: 'SYNC_SUMMARY',
        }),
        payloadId: '11',
      });
      mockPayloadProgressListener?.({
        bytesTransferred: 1593,
        endpointId: 'endpoint-1',
        fileUri: 'file:///incoming-projection.json',
        payloadId: 'payload-file-1',
        payloadKind: 'file',
        status: 'success',
        totalBytes: 1593,
      });
      mockEnvelopeReceivedListener?.({
        endpointId: 'endpoint-1',
        envelopeJson: JSON.stringify({
          entryCount: remoteProjection.entries.length,
          exportId: 'projection-export-remote',
          fileName: 'projection-export-remote.json',
          headHash: remoteProjection.headHash,
          headSyncHash: remoteProjection.headSyncHash,
          payloadId: 'payload-file-1',
          projectionScope: remoteProjection.scope,
          projectionSyncSchemaVersion: remoteProjection.syncSchemaVersion,
          protocolVersion: 1,
          sentAt: new Date().toISOString(),
          sessionId: 'remote-session-1',
          type: 'HISTORY_FILE_META',
        }),
        payloadId: '12',
      });
      mockEnvelopeReceivedListener?.({
        endpointId: 'endpoint-1',
        envelopeJson: JSON.stringify({
          bundleHash: preparedBundle.sharedBundle.bundleHash,
          childReconciliationCount:
            preparedBundle.sharedBundle.childReconciliations.length,
          commonBaseHash: preparedBundle.sharedBundle.commonBaseHash,
          mergedChildCount: Object.keys(
            preparedBundle.sharedBundle.mergedHead.childrenById,
          ).length,
          mergedHeadSyncHash: preparedBundle.sharedBundle.mergedHeadSyncHash,
          mode: preparedBundle.sharedBundle.mode,
          protocolVersion: 1,
          sentAt: new Date().toISOString(),
          sessionId: 'remote-session-1',
          type: 'MERGE_RESULT',
        }),
        payloadId: '13',
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId('phase').props.children).toBe('review'),
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Confirm Sync'));
    });

    await act(async () => {
      mockEnvelopeReceivedListener?.({
        endpointId: 'endpoint-1',
        envelopeJson: JSON.stringify({
          bundleHash: preparedBundle.sharedBundle.bundleHash,
          mergedHeadSyncHash: preparedBundle.sharedBundle.mergedHeadSyncHash,
          protocolVersion: 1,
          sentAt: new Date().toISOString(),
          sessionId: 'remote-session-1',
          type: 'PREPARE_ACK',
          userConfirmed: true,
        }),
        payloadId: '14',
      });
      mockEnvelopeReceivedListener?.({
        endpointId: 'endpoint-1',
        envelopeJson: JSON.stringify({
          applied: true,
          bundleHash: preparedBundle.sharedBundle.bundleHash,
          errorCode: null,
          errorMessage: null,
          protocolVersion: 1,
          sentAt: new Date().toISOString(),
          sessionId: 'remote-session-1',
          type: 'COMMIT_ACK',
        }),
        payloadId: '15',
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId('phase').props.children).toBe('success'),
    );

    await act(async () => {
      mockPayloadProgressListener?.({
        bytesTransferred: 0,
        endpointId: 'endpoint-1',
        fileUri: null,
        payloadId: 'teardown-payload-1',
        payloadKind: 'bytes',
        status: 'canceled',
        totalBytes: 0,
      });
      mockConnectionStateChangedListener?.({
        endpointId: 'endpoint-1',
        endpointName: 'Parent-V9FZ',
        reason: 'remote-disconnect',
        state: 'disconnected',
      });
    });

    expect(screen.getByTestId('phase').props.children).toBe('success');
    expect(screen.getByTestId('error-message').props.children).toBe('none');
  });
});
