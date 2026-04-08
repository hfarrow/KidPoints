import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { TimerCheckInModal } from '../../../src/features/notifications/TimerCheckInModal';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockDismissCheckInFlow = jest.fn();
const mockResolveExpiredTimerChild = jest.fn();
const mockUseNotifications = jest.fn();
const mockUseParentSession = jest.fn();
const mockUseLocalSettingsStore = jest.fn();
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
    push: mockPush,
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
    selector: (state: { parentPin: string | null }) => unknown,
  ) => selector({ parentPin: mockUseLocalSettingsStore() }),
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
    mockUseLocalSettingsStore.mockReturnValue('2468');
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

    fireEvent.press(screen.getByLabelText('Award point to Avery'));
    expect(mockResolveExpiredTimerChild).toHaveBeenCalledWith(
      'child-1',
      'awarded',
    );
  });
});
