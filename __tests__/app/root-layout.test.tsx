import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import RootLayout from '../../app/_layout';

const mockPathname = '/';
const mockSegments = ['(tabs)', 'index'];

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

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
    options?: { presentation?: string };
  }) {
    return <Text>{`${name}:${options?.presentation ?? 'default'}`}</Text>;
  }

  Stack.Screen = MockStackScreen;

  return {
    Stack,
    usePathname: () => mockPathname,
    useSegments: () => mockSegments,
  };
});

describe('RootLayout', () => {
  it('keeps only the lightweight prompt routes in the root stack', () => {
    render(<RootLayout />);

    expect(screen.getByText('(tabs):default')).toBeTruthy();
    expect(screen.getByText('parent-unlock:transparentModal')).toBeTruthy();
    expect(screen.getByText('text-input-modal:transparentModal')).toBeTruthy();
  });
});
