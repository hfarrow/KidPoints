import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useParentSession } from '../../src/features/parent/parentSessionContext';
import { useAppTheme } from '../../src/features/theme/themeContext';
import { createModuleLogger } from '../../src/logging/logger';

const log = createModuleLogger('tabs-layout');

export default function TabsLayout() {
  const router = useRouter();
  const { isParentUnlocked } = useParentSession();
  const { tokens } = useAppTheme();

  useEffect(() => {
    log.debug('Tabs layout initialized');
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: tokens.screenBackground,
        },
        tabBarActiveBackgroundColor: tokens.tabBarActiveBackground,
        tabBarActiveTintColor: tokens.tabBarActiveTint,
        tabBarInactiveTintColor: tokens.tabBarInactiveTint,
        tabBarStyle: {
          height: 78,
          backgroundColor: tokens.tabBarBackground,
          borderTopColor: tokens.border,
          paddingBottom: 14,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 6,
          marginTop: 2,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '800',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="home-outline" size={size} />
          ),
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="alarm"
        listeners={{
          tabPress: (event) => {
            if (isParentUnlocked) {
              return;
            }

            event.preventDefault();
            router.push('/parent-unlock');
          },
        }}
        options={{
          title: 'Alarm',
          tabBarIcon: ({ color, size }) => (
            <Feather color={color} name="clock" size={size} />
          ),
          tabBarLabel: 'Alarm',
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              color={color}
              name="shopping-outline"
              size={size}
            />
          ),
          tabBarLabel: 'Shop',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="list-browser"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
