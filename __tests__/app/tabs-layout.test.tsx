import { render, screen } from '@testing-library/react-native';

import TabsLayout from '../../app/(tabs)/_layout';

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

jest.mock('../../src/features/parent/parentSessionContext', () => ({
  useParentSession: () => ({
    isParentUnlocked: true,
  }),
}));

jest.mock('../../src/features/theme/appTheme', () => ({
  useAppTheme: () => ({
    tokens: {
      border: '#cbd5e1',
      screenBackground: '#ffffff',
      tabBarActiveBackground: '#dbeafe',
      tabBarActiveTint: '#2563eb',
      tabBarBackground: '#f8fafc',
      tabBarInactiveTint: '#64748b',
    },
  }),
}));

describe('TabsLayout', () => {
  it('configures only the primary tab destinations', () => {
    render(<TabsLayout />);

    expect(screen.getByText('index:Home:tab')).toBeTruthy();
    expect(screen.getByText('alarm:Alarm:tab')).toBeTruthy();
    expect(screen.getByText('shop:Shop:tab')).toBeTruthy();
  });
});
