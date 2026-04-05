import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';

import { useParentUnlockAction } from '../../src/features/app/useParentUnlockAction';
import { useAppTheme } from '../../src/features/theme/themeContext';

export default function TabsLayout() {
  const router = useRouter();
  const { parentPinModal, requestParentUnlock } = useParentUnlockAction();
  const { tokens } = useAppTheme();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveBackgroundColor: tokens.tabBarActiveBackground,
          tabBarActiveTintColor: tokens.tabBarActiveTint,
          tabBarInactiveTintColor: tokens.tabBarInactiveTint,
          tabBarStyle: {
            height: 82,
            backgroundColor: tokens.tabBarBackground,
            borderTopColor: tokens.border,
            paddingBottom: 18,
            paddingTop: 8,
          },
          tabBarItemStyle: {
            borderRadius: 18,
            marginHorizontal: 6,
            paddingTop: 2,
          },
          tabBarLabelStyle: {
            fontSize: 13,
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
          listeners={{
            tabPress: (event) => {
              const didProceed = requestParentUnlock(() => {
                router.push('/alarm');
              });

              if (!didProceed) {
                event.preventDefault();
              }
            },
          }}
          name="alarm"
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
      </Tabs>
      {parentPinModal}
    </>
  );
}
