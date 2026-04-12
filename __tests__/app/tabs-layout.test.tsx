import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import TabsLayout from '../../app/(tabs)/_layout';

const mockPush = jest.fn();
const mockInsets = {
  bottom: 0,
  left: 0,
  right: 0,
  top: 0,
};
let capturedScreenOptions: Record<string, unknown> | undefined;

jest.mock('expo-router', () => {
  const mockReactNative = jest.requireActual('react-native');
  const { Text, View } = mockReactNative;
  const Tabs = ({
    children,
    screenOptions,
  }: {
    children: ReactNode;
    screenOptions?: Record<string, unknown>;
  }) => {
    capturedScreenOptions = screenOptions;

    return <View testID="tabs-layout">{children}</View>;
  };
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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

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
  beforeEach(() => {
    capturedScreenOptions = undefined;
    mockInsets.bottom = 0;
    mockInsets.left = 0;
    mockInsets.right = 0;
    mockInsets.top = 0;
  });

  it('configures only the primary tab destinations', () => {
    render(<TabsLayout />);

    expect(screen.getByText('index:Home:tab')).toBeTruthy();
    expect(screen.getByText('alarm:Alarm:tab')).toBeTruthy();
    expect(screen.getByText('shop:Shop:tab')).toBeTruthy();
  });

  it('adds the bottom safe-area inset to the custom tab bar dimensions', () => {
    mockInsets.bottom = 24;

    render(<TabsLayout />);

    expect(capturedScreenOptions).toMatchObject({
      headerShown: false,
      sceneStyle: {
        backgroundColor: '#ffffff',
      },
      tabBarActiveBackgroundColor: '#dbeafe',
      tabBarActiveTintColor: '#2563eb',
      tabBarInactiveTintColor: '#64748b',
      tabBarStyle: {
        backgroundColor: '#f8fafc',
        borderTopColor: '#cbd5e1',
        height: 102,
        paddingBottom: 38,
        paddingTop: 8,
      },
    });
  });
});
