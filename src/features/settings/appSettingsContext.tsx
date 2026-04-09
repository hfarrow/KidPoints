import { type PropsWithChildren, useEffect } from 'react';
import type { StateStorage } from 'zustand/middleware';

import type { AppLogLevel } from '../../logging/logger';
import { createModuleLogger } from '../../logging/logger';
import { LocalSettingsStoreProvider } from '../../state/localSettingsStore';
import type { ThemeMode } from '../theme/theme';

const log = createModuleLogger('app-settings-context');

type AppSettingsProviderProps = PropsWithChildren<{
  allowTemporaryLogLevel?: boolean;
  initialHapticsEnabled?: boolean;
  initialLogLevel?: AppLogLevel;
  initialNotificationsEnabled?: boolean;
  initialParentPin?: string | null;
  initialRestartCountdownAfterCheckIn?: boolean;
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
}>;

export function AppSettingsProvider({
  allowTemporaryLogLevel,
  children,
  initialHapticsEnabled,
  initialLogLevel,
  initialNotificationsEnabled,
  initialParentPin,
  initialRestartCountdownAfterCheckIn,
  initialThemeMode = 'system',
  storage,
}: AppSettingsProviderProps) {
  useEffect(() => {
    log.info('App settings provider initialized', {
      initialThemeMode,
    });
  }, [initialThemeMode]);

  return (
    <LocalSettingsStoreProvider
      allowTemporaryLogLevel={allowTemporaryLogLevel}
      initialHapticsEnabled={initialHapticsEnabled}
      initialLogLevel={initialLogLevel}
      initialNotificationsEnabled={initialNotificationsEnabled}
      initialParentPin={initialParentPin}
      initialRestartCountdownAfterCheckIn={initialRestartCountdownAfterCheckIn}
      initialThemeMode={initialThemeMode}
      storage={storage}
    >
      {children}
    </LocalSettingsStoreProvider>
  );
}
