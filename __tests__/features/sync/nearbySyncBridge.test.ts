describe('nearbySyncBridge', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('falls back safely when the native module is unavailable', async () => {
    jest.doMock('expo-modules-core', () => ({
      requireOptionalNativeModule: jest.fn(() => null),
    }));

    let nearbySyncBridge!: typeof import('../../../src/features/sync/nearbySyncBridge');
    jest.isolateModules(() => {
      nearbySyncBridge = jest.requireActual(
        '../../../src/features/sync/nearbySyncBridge',
      );
    });

    expect(nearbySyncBridge.isNearbySyncModuleAvailable()).toBe(false);
    await expect(nearbySyncBridge.isAvailable()).resolves.toEqual({
      isReady: false,
      isSupported: false,
      playServicesStatus: null,
      reason: 'module-unavailable',
    });
    await expect(
      nearbySyncBridge.startHosting({
        localEndpointName: 'Parent-AAAA',
        sessionLabel: 'KidPoints-AB12',
      }),
    ).resolves.toBeUndefined();
    expect(nearbySyncBridge.getBufferedNearbySyncLogs()).toEqual([]);
    expect(nearbySyncBridge.addEnvelopeReceivedListener(jest.fn())).toBeNull();
  });

  it('requests permissions, parses listeners, and forwards buffered native logs', async () => {
    const subscriptions: ((event: unknown) => void)[] = [];
    const nativeModule = {
      acceptConnection: jest.fn(async () => undefined),
      addListener: jest.fn(
        (_eventName: string, listener: (event: unknown) => void) => {
          subscriptions.push(listener);
          return { remove: jest.fn() };
        },
      ),
      disconnect: jest.fn(async () => undefined),
      getAvailabilityStatus: jest.fn(async () => ({
        isReady: true,
        isSupported: true,
        playServicesStatus: 0,
        reason: 'ready',
      })),
      getBufferedLogs: jest.fn(() =>
        JSON.stringify([
          {
            contextJson: JSON.stringify({ source: 'buffer' }),
            level: 'temp',
            message: 'Buffered nearby sync log',
            sequence: 2,
            tag: 'KidPointsNearbySync',
            timestampMs: 123,
          },
        ]),
      ),
      rejectConnection: jest.fn(async () => undefined),
      requestConnection: jest.fn(async () => undefined),
      sendEnvelope: jest.fn(async () => 11),
      sendFile: jest.fn(async () => 22),
      startDiscovery: jest.fn(async () => undefined),
      startHosting: jest.fn(async () => undefined),
      stopAll: jest.fn(async () => undefined),
    };

    jest.doMock('expo-modules-core', () => ({
      requireOptionalNativeModule: jest.fn(() => nativeModule),
    }));
    jest.doMock('react-native', () => {
      return {
        PermissionsAndroid: {
          PERMISSIONS: {
            BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
            BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
            NEARBY_WIFI_DEVICES: 'android.permission.NEARBY_WIFI_DEVICES',
          },
          RESULTS: {
            GRANTED: 'granted',
          },
          requestMultiple: jest.fn(async (permissions: string[]) =>
            Object.fromEntries(
              permissions.map((permission) => [permission, 'granted']),
            ),
          ),
        },
        Platform: {
          OS: 'android',
          Version: 33,
        },
      };
    });

    let nearbySyncBridge!: typeof import('../../../src/features/sync/nearbySyncBridge');
    jest.isolateModules(() => {
      nearbySyncBridge = jest.requireActual(
        '../../../src/features/sync/nearbySyncBridge',
      );
    });

    const permissions = await nearbySyncBridge.requestPermissions();
    const availability = await nearbySyncBridge.isAvailable();
    const discoveredListener = jest.fn();
    const envelopeListener = jest.fn();
    const logListener = jest.fn();

    nearbySyncBridge.addDiscoveryUpdatedListener(discoveredListener);
    nearbySyncBridge.addEnvelopeReceivedListener(envelopeListener);
    nearbySyncBridge.addNearbySyncLogListener(logListener);

    subscriptions[0]?.({
      endpoints: [{ endpointId: 'endpoint-1', endpointName: 'KidPoints-AB12' }],
    });
    subscriptions[1]?.({
      endpointId: 'endpoint-1',
      envelopeJson: '{"type":"HELLO"}',
      payloadId: 12,
    });
    subscriptions[2]?.({
      contextJson: JSON.stringify({ source: 'live' }),
      level: 'info',
      message: 'Live nearby sync log',
      sequence: 3,
      tag: 'KidPointsNearbySync',
      timestampMs: 456,
    });

    expect(permissions).toMatchObject({
      allGranted: true,
    });
    expect(availability).toEqual({
      isReady: true,
      isSupported: true,
      playServicesStatus: 0,
      reason: 'ready',
    });
    expect(discoveredListener).toHaveBeenCalledWith({
      endpoints: [{ endpointId: 'endpoint-1', endpointName: 'KidPoints-AB12' }],
    });
    expect(envelopeListener).toHaveBeenCalledWith({
      endpointId: 'endpoint-1',
      envelopeJson: '{"type":"HELLO"}',
      payloadId: 12,
    });
    expect(logListener).toHaveBeenCalledWith({
      contextJson: JSON.stringify({ source: 'live' }),
      level: 'info',
      message: 'Live nearby sync log',
      sequence: 3,
      tag: 'KidPointsNearbySync',
      timestampMs: 456,
    });
    expect(nearbySyncBridge.getBufferedNearbySyncLogs()).toEqual([
      {
        contextJson: JSON.stringify({ source: 'buffer' }),
        level: 'temp',
        message: 'Buffered nearby sync log',
        sequence: 2,
        tag: 'KidPointsNearbySync',
        timestampMs: 123,
      },
    ]);
  });
});
