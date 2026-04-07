import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useAppTheme } from '../src/features/theme/themeContext';
import { AppProviders } from '../src/providers/AppProviders';

function RootNavigator() {
  const { statusBarStyle } = useAppTheme();

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen
          name="parent-unlock"
          options={{ presentation: 'transparentModal' }}
        />
        <Stack.Screen name="list-browser" />
        <Stack.Screen
          name="edit-dialog"
          options={{ presentation: 'transparentModal' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
