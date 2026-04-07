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
    options?: { href?: null; title?: string };
  }) {
    const tabVisibility = options?.href === null ? 'hidden' : 'tab';

    return <Text>{`${name}:${options?.title ?? ''}:${tabVisibility}`}</Text>;
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
  it('configures the primary tabs and hides fullscreen support screens from the tab bar', () => {
    render(
      <AppProviders>
        <TabsLayout />
      </AppProviders>,
    );

    expect(screen.getByText('index:Home:tab')).toBeTruthy();
    expect(screen.getByText('alarm:Alarm:tab')).toBeTruthy();
    expect(screen.getByText('shop:Shop:tab')).toBeTruthy();
    expect(screen.getByText('settings::hidden')).toBeTruthy();
    expect(screen.getByText('list-browser::hidden')).toBeTruthy();
    expect(screen.getByText('transactions::hidden')).toBeTruthy();
  });
});
