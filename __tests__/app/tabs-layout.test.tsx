import { render, screen } from '@testing-library/react-native';

import TabsLayout from '../../app/(tabs)/_layout';
import { AppProviders } from '../../src/providers/AppProviders';

const mockPush = jest.fn();

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
    return <Text>{`${name}:${options?.title ?? ''}`}</Text>;
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
  it('configures the three primary tabs', () => {
    render(
      <AppProviders>
        <TabsLayout />
      </AppProviders>,
    );

    expect(screen.getByText('index:Home')).toBeTruthy();
    expect(screen.getByText('alarm:Alarm')).toBeTruthy();
    expect(screen.getByText('shop:Shop')).toBeTruthy();
  });
});
