import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppStorageProvider } from '../src/features/app/appStorage';

export default function RootLayout() {
  return (
    <AppStorageProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AppStorageProvider>
  );
}
