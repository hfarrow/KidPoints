import { Tabs, useRouter } from 'expo-router';
import { useState } from 'react';

import { ParentPinModal } from '../../src/components/ParentPinModal';
import { useAppStorage } from '../../src/features/app/appStorage';

export default function TabsLayout() {
  const router = useRouter();
  const { parentSession, unlockParent } = useAppStorage();
  const [pinModalVisible, setPinModalVisible] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveBackgroundColor: '#e2e8f0',
          tabBarActiveTintColor: '#0f172a',
          tabBarInactiveTintColor: '#64748b',
          tabBarStyle: {
            height: 82,
            backgroundColor: '#f8fafc',
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
              if (parentSession.isUnlocked) {
                return;
              }

              event.preventDefault();
              setPinModalVisible(true);
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
      <ParentPinModal
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
        onSubmit={(pin) => {
          const success = unlockParent(pin);

          if (success) {
            router.push('/alarm');
          }

          return success;
        }}
      />
    </>
  );
}
