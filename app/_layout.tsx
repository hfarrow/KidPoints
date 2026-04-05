import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppStorageProvider } from '../src/features/app/appStorage';
import {
  AppThemeProvider,
  useAppTheme,
} from '../src/features/theme/themeContext';

export default function RootLayout() {
  return (
    <AppStorageProvider>
      <AppThemeProvider>
        <RootNavigator />
      </AppThemeProvider>
    </AppStorageProvider>
  );
}

function RootNavigator() {
  const { statusBarStyle } = useAppTheme();

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
