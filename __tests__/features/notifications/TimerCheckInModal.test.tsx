import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { TimerCheckInModal } from '../../../src/features/notifications/TimerCheckInModal';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDismissCheckInFlow = jest.fn();
const mockResolveExpiredTimerChild = jest.fn();
const mockUseNotifications = jest.fn();
const mockUseParentSession = jest.fn();
const mockSetRestartCountdownAfterCheckIn = jest.fn();
const mockKeyboardModalFrame = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const { Text } = jest.requireActual('react-native');

  return {
    Feather: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: mockCanGoBack,
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock('../../../src/components/KeyboardModalFrame', () => ({
  KeyboardModalFrame: (props: {
    children: ReactNode;
    initialVerticalPosition?: 'bottom' | 'center';
  }) => {
    mockKeyboardModalFrame(props);

    return <>{props.children}</>;
  },
}));

jest.mock('../../../src/components/LoggedPressable', () => ({
  LoggedPressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children: ReactNode;
    disabled?: boolean;
    onPress: () => void;
  }) => {
    const { Pressable } = jest.requireActual('react-native');

    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={onPress}
      >
        {children}
      </Pressable>
    );
  },
}));

jest.mock('../../../src/components/Skeleton', () => ({
  ActionPill: ({ label, onPress }: { label: string; onPress: () => void }) =>
    (() => {
      const { Pressable, Text } = jest.requireActual('react-native');

      return (
        <Pressable onPress={onPress}>
          <Text>{label}</Text>
        </Pressable>
      );
    })(),
  ActionPillRow: ({ children }: { children: ReactNode }) =>
    (() => {
      const { View } = jest.requireActual('react-native');

      return <View>{children}</View>;
    })(),
  StatusBadge: ({ label }: { label: string }) => {
    const { Text } = jest.requireActual('react-native');

    return <Text>{label}</Text>;
  },
}));

jest.mock('../../../src/features/notifications/NotificationsProvider', () => ({
  useNotifications: () => mockUseNotifications(),
}));

jest.mock('../../../src/features/parent/parentSessionContext', () => ({
  useParentSession: () => mockUseParentSession(),
}));

jest.mock('../../../src/state/localSettingsStore', () => ({
  useLocalSettingsStore: (
    selector: (state: {
      parentPin: string | null;
      restartCountdownAfterCheckIn: boolean;
      setRestartCountdownAfterCheckIn: (value: boolean) => void;
    }) => unknown,
  ) =>
    selector({
      parentPin: '2468',
      restartCountdownAfterCheckIn: true,
      setRestartCountdownAfterCheckIn: mockSetRestartCountdownAfterCheckIn,
    }),
}));

jest.mock('../../../src/features/theme/themeContext', () => ({
  useAppTheme: () => ({
    tokens: {
      accent: '#2563eb',
      border: '#cbd5e1',
      controlSurface: '#e2e8f0',
      controlText: '#0f172a',
      critical: '#9d174d',
      modalBackdrop: 'rgba(15, 23, 42, 0.65)',
      modalSurface: '#ffffff',
      success: '#15803d',
      textMuted: '#64748b',
      textPrimary: '#0f172a',
    },
  }),
  useThemedStyles: <T,>(
    createStyles: (theme: { tokens: Record<string, string> }) => T,
  ) =>
    createStyles({
      tokens: {
        accent: '#2563eb',
        border: '#cbd5e1',
        controlSurface: '#e2e8f0',
        controlText: '#0f172a',
        critical: '#9d174d',
        modalBackdrop: 'rgba(15, 23, 42, 0.65)',
        modalSurface: '#ffffff',
        success: '#15803d',
        textMuted: '#64748b',
        textPrimary: '#0f172a',
      },
    }),
}));

describe('TimerCheckInModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack.mockReturnValue(true);
    mockUseNotifications.mockReturnValue({
      activeExpiredTimerSession: {
        childActions: [
          { childId: 'child-1', childName: 'Avery', status: 'pending' },
        ],
        intervalId: 'interval-1',
        notificationId: 5001,
        sessionId: 'session-1',
        triggeredAt: 100,
      },
      dismissCheckInFlow: mockDismissCheckInFlow,
      resolveExpiredTimerChild: mockResolveExpiredTimerChild,
    });
  });

  it('routes to parent unlock when the modal is opened while locked', () => {
    mockUseParentSession.mockReturnValue({ isParentUnlocked: false });

    render(<TimerCheckInModal />);

    fireEvent.press(screen.getByText('Unlock'));
    expect(mockPush).toHaveBeenCalledWith('/parent-unlock');
    expect(mockKeyboardModalFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        initialVerticalPosition: 'center',
      }),
    );
  });

  it('shows child actions and resolves awards when the parent session is unlocked', () => {
    mockUseParentSession.mockReturnValue({ isParentUnlocked: true });

    render(<TimerCheckInModal />);

    expect(screen.getByText('Parent Check-In')).toBeTruthy();
    expect(screen.getByText('Avery')).toBeTruthy();
    expect(screen.queryByText(/Review the timer that triggered/i)).toBeNull();
    expect(screen.queryByText('Close')).toBeNull();
    expect(
      screen.getByLabelText('Restart countdown automatically'),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Award point to Avery'));
    expect(mockResolveExpiredTimerChild).toHaveBeenCalledWith(
      'child-1',
      'awarded',
      { restartTimerOnResolve: true },
    );
  });

  it('updates the persisted restart setting when the toggle changes', () => {
    mockUseParentSession.mockReturnValue({ isParentUnlocked: true });

    render(<TimerCheckInModal />);

    fireEvent(
      screen.getByLabelText('Restart countdown automatically'),
      'valueChange',
      false,
    );
    expect(mockSetRestartCountdownAfterCheckIn).toHaveBeenCalledWith(false);
    fireEvent.press(screen.getByLabelText('Dismiss point for Avery'));
  });

  it('closes with back navigation after the active session is cleared', async () => {
    mockUseParentSession.mockReturnValue({ isParentUnlocked: true });
    mockUseNotifications.mockReturnValue({
      activeExpiredTimerSession: null,
      dismissCheckInFlow: mockDismissCheckInFlow,
      resolveExpiredTimerChild: mockResolveExpiredTimerChild,
    });

    render(<TimerCheckInModal />);

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to replacing the root route when no back navigation is available', async () => {
    mockCanGoBack.mockReturnValue(false);
    mockUseParentSession.mockReturnValue({ isParentUnlocked: true });
    mockUseNotifications.mockReturnValue({
      activeExpiredTimerSession: null,
      dismissCheckInFlow: mockDismissCheckInFlow,
      resolveExpiredTimerChild: mockResolveExpiredTimerChild,
    });

    render(<TimerCheckInModal />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
    expect(mockBack).not.toHaveBeenCalled();
  });
});
