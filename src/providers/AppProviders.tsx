import { type PropsWithChildren, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { NotificationsProvider } from '../features/notifications/NotificationsProvider';
import { ParentSessionProvider } from '../features/parent/parentSessionContext';
import { AppThemeProvider } from '../features/theme/themeContext';
import {
  createModuleLogger,
  getAppLogLevel,
  normalizeAppLogLevel,
  setAppLogLevel,
} from '../logging/logger';
import { useLocalSettingsStore } from '../state/localSettingsStore';
import { SharedStoreProvider } from '../state/sharedStore';

const log = createModuleLogger('app-providers');

function AppLogLevelObserver() {
  const logLevel = useLocalSettingsStore((state) => state.logLevel);

  useEffect(() => {
    const previousLogLevel = getAppLogLevel();
    const normalizedLogLevel = normalizeAppLogLevel(logLevel, {
      fallbackLogLevel: previousLogLevel,
    });

    setAppLogLevel(normalizedLogLevel);
    log.info('App log level applied', {
      from: previousLogLevel,
      requestedLogLevel: logLevel,
      to: normalizedLogLevel,
    });
  }, [logLevel]);

  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    log.info('App providers initialized');
  }, []);

  useEffect(() => {
    log.info('App state observer initialized', {
      appState: appStateRef.current,
    });

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = appStateRef.current;

      if (previousAppState === nextAppState) {
        return;
      }

      if (
        previousAppState === 'active' &&
        (nextAppState === 'inactive' || nextAppState === 'background')
      ) {
        log.info('App moved to background', {
          from: previousAppState,
          to: nextAppState,
        });
      } else if (
        (previousAppState === 'background' ||
          previousAppState === 'inactive') &&
        nextAppState === 'active'
      ) {
        log.info('App moved to foreground', {
          from: previousAppState,
          to: nextAppState,
        });
      } else {
        log.info('App state changed', {
          from: previousAppState,
          to: nextAppState,
        });
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <KeyboardProvider>
        <SharedStoreProvider>
          <ParentSessionProvider>
            <AppThemeProvider>
              <NotificationsProvider>
                <AppLogLevelObserver />
                {children}
              </NotificationsProvider>
            </AppThemeProvider>
          </ParentSessionProvider>
        </SharedStoreProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
