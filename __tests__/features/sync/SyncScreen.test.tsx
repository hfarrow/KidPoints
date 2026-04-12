import { act, fireEvent, render, screen } from '@testing-library/react-native';
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

jest.mock('../../../src/state/localSettingsStore', () => ({
  useLocalSettingsStore: (
    selector: (state: { hapticsEnabled: boolean }) => unknown,
  ) =>
    selector({
      hapticsEnabled: true,
    }),
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
      criticalSurface: '#fee2e2',
      controlSurface: '#e2e8f0',
      controlText: '#0f172a',
      floatingLabelSurface: '#fef3c7',
      inputSurface: '#e2e8f0',
      modalBackdrop: 'rgba(15, 23, 42, 0.5)',
      modalSurface: '#ffffff',
      screenBackground: '#f8fafc',
      success: '#16a34a',
      successSurface: '#dcfce7',
      successText: '#166534',
      textMuted: '#475569',
      textPrimary: '#0f172a',
      tileBorder: '#cbd5e1',
      transactionLocalSurface: '#f8fafc',
      transactionSyncedSurface: '#e2e8f0',
      warningText: '#92400e',
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
        criticalSurface: '#fee2e2',
        controlSurface: '#e2e8f0',
        controlText: '#0f172a',
        floatingLabelSurface: '#fef3c7',
        inputSurface: '#e2e8f0',
        modalBackdrop: 'rgba(15, 23, 42, 0.5)',
        modalSurface: '#ffffff',
        screenBackground: '#f8fafc',
        success: '#16a34a',
        successSurface: '#dcfce7',
        successText: '#166534',
        textMuted: '#475569',
        textPrimary: '#0f172a',
        tileBorder: '#cbd5e1',
        transactionLocalSurface: '#f8fafc',
        transactionSyncedSurface: '#e2e8f0',
        warningText: '#92400e',
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
  ScreenBackFooter: () => {
    const { Text } = jest.requireActual('react-native');

    return <Text>Back</Text>;
  },
}));

describe('SyncScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto-starts sync and shows friendly instructions from the idle state', () => {
    render(<SyncScreen />);

    expect(screen.getByText('Device Sync')).toBeTruthy();
    expect(screen.getByText('Syncing')).toBeTruthy();
    expect(screen.getAllByText(/Searching/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Keep the app open on both phones and hold them back to back.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.queryByText('Cancel Sync')).toBeNull();
    expect(screen.queryByText('Instructions')).toBeNull();
    expect(mockSession.startSyncFlow).toHaveBeenCalled();
  });

  it('uses the same combined searching tile while bootstrapping', () => {
    mockSession.state.phase = 'bootstrapping';
    mockSession.state.nfcBootstrap = {
      ...mockSession.state.nfcBootstrap,
      phase: 'starting',
    };

    render(<SyncScreen />);

    expect(screen.getByText('Syncing')).toBeTruthy();
    expect(screen.getAllByText(/Searching/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Keep the app open on both phones and hold them back to back.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Keep both phones back-to-back while KidPoints finds the matching device.',
      ),
    ).toBeNull();
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.queryByText('Cancel Sync')).toBeNull();
  });

  it('renders the friendly review tile and confirm action in review state', () => {
    mockSession.state.phase = 'review';
    mockSession.state.review = {
      children: [
        {
          basePoints: 5,
          change: 'unchanged',
          childId: 'child-1',
          childName: 'Ava',
          localNewContributionPoints: 5,
          points: 12,
          remoteNewContributionPoints: 2,
        },
      ],
      outcome: 'merged',
      outcomeCopy: 'The histories of both devices have been merged.',
      transactions: [
        {
          id: 'base-change-1',
          origin: 'base',
          summaryText: 'Ava Set Points [0 > 5]',
          timestampLabel: 'Apr 11, 9:00 AM',
        },
        {
          id: 'change-1',
          origin: 'local',
          summaryText: 'Ava +2 Points [10 > 12]',
          timestampLabel: 'Apr 11, 9:30 AM',
        },
      ],
    };

    render(<SyncScreen />);

    expect(screen.getByText('Review Sync')).toBeTruthy();
    expect(
      screen.getByText('The histories of both devices have been merged.'),
    ).toBeTruthy();
    expect(
      screen.getByText('5 (base) + 5 (yours) + 2 (theirs) = 12'),
    ).toBeTruthy();
    expect(screen.getByText('Ava Set Points [0 > 5]')).toBeTruthy();
    expect(screen.getByText('Base')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Confirm Sync')[0]);

    expect(mockSession.confirmMergeAndPrepareCommit).toHaveBeenCalled();
  });

  it('silently retries NFC timeouts without showing an error state', () => {
    jest.useFakeTimers();
    mockSession.state.phase = 'error';
    mockSession.state.errorCode = 'nfc-bootstrap-timeout';
    mockSession.state.errorMessage = 'The phones did not connect in time.';
    mockSession.state.nfcBootstrap = {
      ...mockSession.state.nfcBootstrap,
      failureReason: 'timeout',
      message: 'The phones did not connect in time.',
      phase: 'error',
    };

    render(<SyncScreen />);

    expect(screen.getByText('Syncing')).toBeTruthy();
    expect(screen.getAllByText(/Searching/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Keep the app open on both phones and hold them back to back.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.queryByText('Cancel Sync')).toBeNull();
    expect(screen.queryByText('Try Again')).toBeNull();
    expect(screen.queryByText("We couldn't finish syncing yet.")).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    expect(mockSession.startSyncFlow).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('uses cancel sync after the searching phase', () => {
    mockSession.state.phase = 'transferring';

    render(<SyncScreen />);

    expect(screen.getByText('Cancel Sync')).toBeTruthy();
    expect(screen.queryByText('Back')).toBeNull();
  });
});
