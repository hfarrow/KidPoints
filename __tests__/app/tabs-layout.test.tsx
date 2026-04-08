import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import TabsLayout from '../../app/(tabs)/_layout';
import { AppProviders } from '../../src/providers/AppProviders';

const mockPush = jest.fn();

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
  const Tabs = ({ children }: { children: unknown }) => (
    <View testID="tabs-layout">{children}</View>
  );
  function MockTabsScreen({
    name,
    options,
  }: {
    name: string;
    options?: { title?: string };
  }) {
    return <Text>{`${name}:${options?.title ?? ''}:tab`}</Text>;
  }
  Tabs.displayName = 'MockTabs';
  MockTabsScreen.displayName = 'MockTabsScreen';
  Tabs.Screen = MockTabsScreen;

  return {
    Tabs,
    useRouter: () => ({ push: mockPush }),
  };
});

describe('TabsLayout', () => {
  it('configures only the primary tab destinations', () => {
    render(
      <AppProviders>
        <TabsLayout />
      </AppProviders>,
    );

    expect(screen.getByText('index:Home:tab')).toBeTruthy();
    expect(screen.getByText('alarm:Alarm:tab')).toBeTruthy();
    expect(screen.getByText('shop:Shop:tab')).toBeTruthy();
  });
});
