import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import RootLayout from '../../app/_layout';

const mockPathname = '/';
const mockSegments = ['(tabs)', 'index'];
const mockPush = jest.fn();

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');

  return {
    SafeAreaProvider: ({ children }: { children: ReactNode }) => (
      <View>{children}</View>
    ),
    initialWindowMetrics: {
      frame: { height: 800, width: 400, x: 0, y: 0 },
      insets: { bottom: 0, left: 0, right: 0, top: 0 },
    },
  };
});

jest.mock('expo-router', () => {
  const mockReactNative = jest.requireActual('react-native');
  const { Text, View } = mockReactNative;

  const Stack = ({ children }: { children: ReactNode }) => (
    <View testID="root-stack">{children}</View>
  );

  function MockStackScreen({
    name,
    options,
  }: {
    name: string;
    options?: { gestureEnabled?: boolean; presentation?: string };
  }) {
    return <Text>{`${name}:${options?.presentation ?? 'default'}`}</Text>;
  }

  Stack.Screen = MockStackScreen;

  return {
    Stack,
    usePathname: () => mockPathname,
    useRootNavigationState: () => ({ key: 'root-ready' }),
    useRouter: () => ({
      push: mockPush,
    }),
    useSegments: () => mockSegments,
  };
});

describe('RootLayout', () => {
  it('registers the tab shell and route-backed modals at the root level', () => {
    render(<RootLayout />);

    expect(screen.getByText('(tabs):default')).toBeTruthy();
    expect(screen.getByText('settings:default')).toBeTruthy();
    expect(screen.getByText('list-browser:default')).toBeTruthy();
    expect(screen.getByText('logs:default')).toBeTruthy();
    expect(screen.getByText('transactions:default')).toBeTruthy();
    expect(screen.getByText('parent-unlock:transparentModal')).toBeTruthy();
    expect(screen.getByText('timer-check-in:transparentModal')).toBeTruthy();
    expect(screen.queryByText('text-input-modal:transparentModal')).toBeNull();
  });
});
