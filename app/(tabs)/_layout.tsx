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
          options={{ title: 'Home', tabBarLabel: 'Home' }}
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
            tabBarLabel: 'Alarm',
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{ title: 'Shop', tabBarLabel: 'Shop' }}
        />
      </Tabs>
      {parentPinModal}
    </>
  );
}
