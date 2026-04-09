import { type PropsWithChildren, useEffect } from 'react';
import type { StateStorage } from 'zustand/middleware';

import type { AppLogLevel } from '../../logging/logger';
import { createModuleLogger } from '../../logging/logger';
import { LocalSettingsStoreProvider } from '../../state/localSettingsStore';
import { DEFAULT_THEME_ID, type ThemeId, type ThemeMode } from '../theme/theme';

const log = createModuleLogger('app-settings-context');

type AppSettingsProviderProps = PropsWithChildren<{
  allowTemporaryLogLevel?: boolean;
  initialActiveThemeId?: ThemeId;
  initialHapticsEnabled?: boolean;
  initialLiveCountdownNotificationsEnabled?: boolean;
  initialLogLevel?: AppLogLevel;
  initialParentPin?: string | null;
  initialRestartCountdownAfterCheckIn?: boolean;
  initialThemeMode?: ThemeMode;
  storage?: StateStorage;
}>;

export function AppSettingsProvider({
  allowTemporaryLogLevel,
  children,
  initialActiveThemeId = DEFAULT_THEME_ID,
  initialHapticsEnabled,
  initialLiveCountdownNotificationsEnabled,
  initialLogLevel,
  initialParentPin,
  initialRestartCountdownAfterCheckIn,
  initialThemeMode = 'system',
  storage,
}: AppSettingsProviderProps) {
  useEffect(() => {
    log.info('App settings provider initialized', {
      initialActiveThemeId,
      initialThemeMode,
    });
  }, [initialActiveThemeId, initialThemeMode]);

  return (
    <LocalSettingsStoreProvider
      allowTemporaryLogLevel={allowTemporaryLogLevel}
      initialActiveThemeId={initialActiveThemeId}
      initialHapticsEnabled={initialHapticsEnabled}
      initialLiveCountdownNotificationsEnabled={
        initialLiveCountdownNotificationsEnabled
      }
      initialLogLevel={initialLogLevel}
      initialParentPin={initialParentPin}
      initialRestartCountdownAfterCheckIn={initialRestartCountdownAfterCheckIn}
      initialThemeMode={initialThemeMode}
      storage={storage}
    >
      {children}
    </LocalSettingsStoreProvider>
  );
}
