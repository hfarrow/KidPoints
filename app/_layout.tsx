import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ListPickerModal } from '../src/features/overlays/ListPickerModal';
import { TextInputModal } from '../src/features/overlays/TextInputModal';
import { ParentPinSetupGate } from '../src/features/parent/ParentPinSetupGate';
import { useAppTheme } from '../src/features/theme/themeContext';
import { RootNavigationLifecycleLogger } from '../src/navigation/RootNavigationLifecycleLogger';
import { StartupNavigationCoordinator } from '../src/navigation/StartupNavigationCoordinator';
import { AppProviders } from '../src/providers/AppProviders';

function RootNavigator() {
  const { statusBarStyle } = useAppTheme();

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="list-browser" />
        <Stack.Screen name="logs" />
        <Stack.Screen name="transactions" />
        <Stack.Screen
          name="parent-unlock"
          options={{ gestureEnabled: false, presentation: 'transparentModal' }}
        />
        <Stack.Screen
          name="timer-check-in"
          options={{ gestureEnabled: false, presentation: 'transparentModal' }}
        />
      </Stack>
      <ListPickerModal />
      <TextInputModal />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigationLifecycleLogger />
      <StartupNavigationCoordinator />
      <ParentPinSetupGate />
      <RootNavigator />
    </AppProviders>
  );
}
