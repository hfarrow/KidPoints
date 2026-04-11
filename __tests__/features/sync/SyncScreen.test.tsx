import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SyncScreen } from '../../../src/features/sync/SyncScreen';
import {
  createInitialSyncSessionState,
  type SyncSessionState,
} from '../../../src/features/sync/syncSessionMachine';

type MockSyncSession = {
  acceptPairingCode: jest.Mock;
  cancelSession: jest.Mock;
  confirmMergeAndPrepareCommit: jest.Mock;
  connectToEndpoint: jest.Mock;
  refreshAvailability: jest.Mock;
  rejectPairingCode: jest.Mock;
  revertLastAppliedSync: jest.Mock;
  startHostFlow: jest.Mock;
  startJoinFlow: jest.Mock;
  startSyncFlow: jest.Mock;
  state: SyncSessionState;
};

const mockSession: MockSyncSession = {
  acceptPairingCode: jest.fn(),
  cancelSession: jest.fn(),
  confirmMergeAndPrepareCommit: jest.fn(),
  connectToEndpoint: jest.fn(),
  refreshAvailability: jest.fn(),
  rejectPairingCode: jest.fn(),
  revertLastAppliedSync: jest.fn(),
  startHostFlow: jest.fn(),
  startJoinFlow: jest.fn(),
  startSyncFlow: jest.fn(),
  state: {
    ...createInitialSyncSessionState(),
    availability: {
      isReady: true,
      isSupported: true,
      playServicesStatus: 0,
      reason: 'ready' as const,
    },
    nfcAvailability: {
      hasAdapter: true,
      isEnabled: true,
      isReady: true,
      reason: 'ready' as const,
      supportsHce: true,
      supportsReaderMode: true,
    },
    permissions: {
      allGranted: true,
      deniedPermissions: [],
      requiredPermissions: [],
      results: {},
    },
  },
};

jest.mock('../../../src/features/sync/useNearbySyncSession', () => ({
  useNearbySyncSession: () => mockSession,
}));

jest.mock('@expo/vector-icons', () => {
  const mockReactNative = jest.requireActual('react-native');
  const { Text } = mockReactNative;

  function MockIcon() {
    return <Text>icon</Text>;
  }

  return {
    Feather: MockIcon,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
  }),
}));

jest.mock('../../../src/features/theme/appTheme', () => ({
  useAppTheme: () => ({
    tokens: {
      accent: '#2563eb',
      border: '#cbd5e1',
      critical: '#dc2626',
      inputSurface: '#e2e8f0',
      modalBackdrop: 'rgba(15, 23, 42, 0.5)',
      modalSurface: '#ffffff',
      screenBackground: '#f8fafc',
      success: '#16a34a',
      textMuted: '#475569',
      textPrimary: '#0f172a',
    },
  }),
  useThemedStyles: (
    factory: (theme: { tokens: Record<string, string> }) => unknown,
  ) =>
    factory({
      tokens: {
        accent: '#2563eb',
        border: '#cbd5e1',
        critical: '#dc2626',
        inputSurface: '#e2e8f0',
        modalBackdrop: 'rgba(15, 23, 42, 0.5)',
        modalSurface: '#ffffff',
        screenBackground: '#f8fafc',
        success: '#16a34a',
        textMuted: '#475569',
        textPrimary: '#0f172a',
      },
    }),
}));

jest.mock('../../../src/components/ScreenScaffold', () => ({
  ScreenScaffold: ({
    children,
    footer,
  }: {
    children: ReactNode;
    footer?: ReactNode;
  }) => (
    <>
      {children}
      {footer}
    </>
  ),
}));

jest.mock('../../../src/components/ScreenHeader', () => ({
  ScreenHeader: ({ title }: { title: string }) => {
    const { Text } = jest.requireActual('react-native');

    return <Text>{title}</Text>;
  },
}));

jest.mock('../../../src/components/ScreenBackFooter', () => ({
  ScreenBackFooter: () => null,
}));

describe('SyncScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the NFC-first sync action from the idle state', () => {
    render(<SyncScreen />);

    expect(screen.getByText('Device Sync')).toBeTruthy();
    fireEvent.press(screen.getByText('Sync Now'));

    expect(mockSession.startSyncFlow).toHaveBeenCalled();
  });

  it('renders the merge summary and confirm action in review state', () => {
    mockSession.state.phase = 'review';
    mockSession.state.review = {
      bundleHash: 'sync-bundle-1234567890',
      childReconciliationCount: 2,
      commonBaseHash: 'sync-base-1234567890',
      mergedChildCount: 1,
      mergedHeadSyncHash: 'sync-head-1234567890',
      mode: 'merged',
      peerEndpointName: 'KidPoints-AB12',
    };

    render(<SyncScreen />);

    expect(screen.getByText('Merge Summary')).toBeTruthy();
    fireEvent.press(screen.getByText('Confirm Sync'));

    expect(mockSession.confirmMergeAndPrepareCommit).toHaveBeenCalled();
  });
});
