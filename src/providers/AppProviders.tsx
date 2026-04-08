import { type PropsWithChildren, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { ParentSessionProvider } from '../features/parent/parentSessionContext';
import { AppThemeProvider } from '../features/theme/themeContext';
import {
  createModuleLogger,
  getAppLogLevel,
  setAppLogLevel,
} from '../logging/logger';
import { useLocalSettingsStore } from '../state/localSettingsStore';
import { SharedStoreProvider } from '../state/sharedStore';

const log = createModuleLogger('app-providers');

function AppLogLevelObserver() {
  const logLevel = useLocalSettingsStore((state) => state.logLevel);

  useEffect(() => {
    const previousLogLevel = getAppLogLevel();

    setAppLogLevel(logLevel);
    log.info('App log level applied', {
      from: previousLogLevel,
      to: logLevel,
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
    <SharedStoreProvider>
      <ParentSessionProvider>
        <AppThemeProvider>
          <AppLogLevelObserver />
          {children}
        </AppThemeProvider>
      </ParentSessionProvider>
    </SharedStoreProvider>
  );
}
