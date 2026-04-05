import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  type AppStateStatus,
  Linking,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { IntervalCheckInModal } from '../src/features/alarm/IntervalCheckInModal';
import {
  addAlarmLaunchActionListener,
  consumePendingAlarmLaunchAction,
  getAlarmRuntimeStatus,
  isAlarmEngineAvailable,
  openExactAlarmSettings,
  openFullScreenIntentSettings,
  openPromotedNotificationSettings,
  stopExpiredAlarmPlayback,
} from '../src/features/app/alarmEngine';
import {
  AppStorageProvider,
  useAppStorage,
} from '../src/features/app/appStorage';
import {
  AppThemeProvider,
  useAppTheme,
} from '../src/features/theme/themeContext';

const ALARM_DEBUG_PREFIX = '[KidPointsAlarmJS]';

function logAlarmDebug(message: string, details?: unknown) {
  if (!__DEV__) {
    return;
  }

  if (details === undefined) {
    console.debug(ALARM_DEBUG_PREFIX, message);
    return;
  }

  console.debug(ALARM_DEBUG_PREFIX, message, details);
}

export default function RootLayout() {
  const [checkInIntervalId, setCheckInIntervalId] = useState<
    string | null | undefined
  >(undefined);

  return (
    <AppStorageProvider>
      <AppThemeProvider>
        <AlarmPermissionBootstrap />
        <CheckInLaunchActionBootstrap
          onRequestCheckIn={(intervalId) => {
            setCheckInIntervalId(intervalId);
          }}
        />
        <CheckInLinkBootstrap
          onRequestCheckIn={() => {
            setCheckInIntervalId(null);
          }}
        />
        <RootNavigator />
        <IntervalCheckInModal
          intervalId={checkInIntervalId}
          onClose={() => {
            setCheckInIntervalId(undefined);
          }}
        />
      </AppThemeProvider>
    </AppStorageProvider>
  );
}

export function AlarmPermissionBootstrap() {
  const { alarmRuntimeStatus, appData, isHydrated, refreshAlarmRuntimeStatus } =
    useAppStorage();
  const didHandleStartupPromptRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (
      didHandleStartupPromptRef.current ||
      !isHydrated ||
      !isAlarmEngineAvailable()
    ) {
      return;
    }

    didHandleStartupPromptRef.current = true;

    if (!appData.timerConfig.notificationsEnabled) {
      logAlarmDebug(
        'Skipped startup prompts because notifications are disabled',
      );
      return;
    }

    let isCancelled = false;

    void (async () => {
      logAlarmDebug('Running Android alarm permission bootstrap');

      if (
        Platform.Version >= 33 &&
        !alarmRuntimeStatus.notificationPermissionGranted
      ) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        logAlarmDebug('Requested POST_NOTIFICATIONS permission');
      }

      if (isCancelled) {
        return;
      }

      const runtimeStatus = await getAlarmRuntimeStatus();

      if (isCancelled) {
        return;
      }

      void refreshAlarmRuntimeStatus();

      if (!runtimeStatus.exactAlarmPermissionGranted) {
        Alert.alert(
          'Enable exact alarms',
          'KidPoints will open Android settings so you can allow exact alarms for reliable background countdowns.',
          [
            {
              style: 'cancel',
              text: 'Not now',
            },
            {
              text: 'Open settings',
              onPress: () => {
                logAlarmDebug(
                  'Opening exact alarm settings from startup prompt',
                );
                void openExactAlarmSettings().then(() => {
                  void refreshAlarmRuntimeStatus();
                });
              },
            },
          ],
        );
        return;
      }

      logAlarmDebug('Exact alarm access already granted');

      if (!runtimeStatus.fullScreenIntentPermissionGranted) {
        if (!runtimeStatus.fullScreenIntentSettingsResolvable) {
          logAlarmDebug(
            'Skipping alarm popup prompt because full-screen intent settings are unavailable on this system build',
          );
        } else {
          Alert.alert(
            'Enable alarm popup',
            'KidPoints can open Android settings so timer expiry can appear as a full alarm alert over other apps.',
            [
              {
                style: 'cancel',
                text: 'Not now',
              },
              {
                text: 'Open settings',
                onPress: () => {
                  logAlarmDebug(
                    'Opening full-screen intent settings from startup prompt',
                  );
                  void openFullScreenIntentSettings().then(() => {
                    void refreshAlarmRuntimeStatus();
                  });
                },
              },
            ],
          );
          return;
        }
      }

      if (runtimeStatus.promotedNotificationPermissionGranted) {
        logAlarmDebug('Promoted notification access already granted');
        return;
      }

      if (!runtimeStatus.promotedNotificationSettingsResolvable) {
        logAlarmDebug(
          'Skipping live update prompt because promoted notification settings are unavailable on this system build',
        );
        return;
      }

      Alert.alert(
        'Enable live updates',
        'KidPoints can open Android settings so the running timer is eligible for a Live Update chip in supported system surfaces.',
        [
          {
            style: 'cancel',
            text: 'Not now',
          },
          {
            text: 'Open settings',
            onPress: () => {
              logAlarmDebug(
                'Opening promoted notification settings from startup prompt',
              );
              void openPromotedNotificationSettings().then(() => {
                void refreshAlarmRuntimeStatus();
              });
            },
          },
        ],
      );
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    alarmRuntimeStatus.notificationPermissionGranted,
    appData.timerConfig.notificationsEnabled,
    isHydrated,
    refreshAlarmRuntimeStatus,
  ]);

  return null;
}

function CheckInLaunchActionBootstrap({
  onRequestCheckIn,
}: {
  onRequestCheckIn: (intervalId: string | null) => void;
}) {
  const { isHydrated, reloadPersistedState } = useAppStorage();

  const consumeAndReloadPendingCheckIn = useCallback(
    async (source: 'startup' | 'event' | 'resume') => {
      const pendingLaunchAction = await consumePendingAlarmLaunchAction();

      if (!pendingLaunchAction || pendingLaunchAction.type !== 'check-in') {
        return;
      }

      logAlarmDebug('Handling pending launch action', {
        pendingLaunchAction,
        source,
      });
      await stopExpiredAlarmPlayback();
      await reloadPersistedState();
      onRequestCheckIn(pendingLaunchAction.intervalId);
    },
    [onRequestCheckIn, reloadPersistedState],
  );

  useEffect(() => {
    if (!isHydrated || !isAlarmEngineAvailable()) {
      return;
    }

    let isCancelled = false;

    void consumeAndReloadPendingCheckIn('startup');

    const subscription = addAlarmLaunchActionListener((launchAction) => {
      if (isCancelled) {
        return;
      }

      logAlarmDebug('Received native launch action event', launchAction);
      void consumeAndReloadPendingCheckIn('event');
    });
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (isCancelled || nextAppState !== 'active') {
          return;
        }

        logAlarmDebug('Checking pending launch action on app resume');
        void consumeAndReloadPendingCheckIn('resume');
      },
    );

    return () => {
      isCancelled = true;
      appStateSubscription.remove();
      subscription?.remove();
    };
  }, [consumeAndReloadPendingCheckIn, isHydrated]);

  return null;
}

function CheckInLinkBootstrap({
  onRequestCheckIn,
}: {
  onRequestCheckIn: () => void;
}) {
  const { isHydrated, reloadPersistedState } = useAppStorage();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const handleUrl = (url: string | null) => {
      if (!url?.includes('checkIn=1')) {
        return;
      }

      logAlarmDebug('Handling check-in URL fallback', { url });
      void reloadPersistedState().then(() => {
        onRequestCheckIn();
      });
    };

    void Linking.getInitialURL().then(handleUrl);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, [isHydrated, onRequestCheckIn, reloadPersistedState]);

  return null;
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
