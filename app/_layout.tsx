import { Stack, usePathname, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { useAppTheme } from '../src/features/theme/themeContext';
import { createModuleLogger } from '../src/logging/logger';
import { AppProviders } from '../src/providers/AppProviders';

const log = createModuleLogger('root-layout');
const MODAL_PATHS = new Set(['/parent-unlock', '/text-input-modal']);

function RootNavigator() {
  const { statusBarStyle } = useAppTheme();

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="parent-unlock"
          options={{ presentation: 'transparentModal' }}
        />
        <Stack.Screen
          name="text-input-modal"
          options={{ presentation: 'transparentModal' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const pathname = usePathname();
  const segments = useSegments();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    log.info('Root layout initialized');
  }, []);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const currentPath = pathname ?? '/';
    const segmentPath = segments.join('/') || '(root)';

    if (previousPath == null) {
      log.info('Navigation route entered', {
        pathname: currentPath,
        segments: segmentPath,
      });
    } else if (previousPath !== currentPath) {
      log.info('Navigation transition', {
        from: previousPath,
        pathname: currentPath,
        segments: segmentPath,
      });
    }

    if (
      previousPath &&
      MODAL_PATHS.has(previousPath) &&
      previousPath !== currentPath
    ) {
      log.info('Modal closed', {
        pathname: previousPath,
        returnedTo: currentPath,
      });
    }

    if (MODAL_PATHS.has(currentPath) && previousPath !== currentPath) {
      log.info('Modal opened', {
        from: previousPath,
        pathname: currentPath,
      });
    }

    previousPathRef.current = currentPath;
  }, [pathname, segments]);

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
