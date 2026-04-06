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
  const handleRequestCheckInFromLaunchAction = useCallback(
    (intervalId: string | null) => {
      setCheckInIntervalId(intervalId);
    },
    [],
  );
  const handleRequestCheckInFromUrl = useCallback(() => {
    setCheckInIntervalId(null);
  }, []);
  const handleCloseCheckInModal = useCallback(() => {
    setCheckInIntervalId(undefined);
  }, []);

  return (
    <AppStorageProvider>
      <AppThemeProvider>
        <AlarmPermissionBootstrap />
        <CheckInLaunchActionBootstrap
          onRequestCheckIn={handleRequestCheckInFromLaunchAction}
        />
        <CheckInLinkBootstrap onRequestCheckIn={handleRequestCheckInFromUrl} />
        <RootNavigator />
        <IntervalCheckInModal
          intervalId={checkInIntervalId}
          onClose={handleCloseCheckInModal}
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
      return;
    }

    let isCancelled = false;

    void (async () => {
      if (
        Platform.Version >= 33 &&
        !alarmRuntimeStatus.notificationPermissionGranted
      ) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
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
                void openExactAlarmSettings().then(() => {
                  void refreshAlarmRuntimeStatus();
                });
              },
            },
          ],
        );
        return;
      }

      if (!runtimeStatus.fullScreenIntentPermissionGranted) {
        if (!runtimeStatus.fullScreenIntentSettingsResolvable) {
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
        return;
      }

      if (!runtimeStatus.promotedNotificationSettingsResolvable) {
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
  const {
    isHydrated,
    reloadPersistedState,
    suppressNextActiveReload = () => {},
  } = useAppStorage();
  const skipNextResumeConsumeRef = useRef(false);
  const didConsumeStartupActionRef = useRef(false);

  const handleLaunchAction = useCallback(
    async (
      pendingLaunchAction: Awaited<
        ReturnType<typeof consumePendingAlarmLaunchAction>
      >,
      source: 'event' | 'startup' | 'resume',
    ) => {
      if (!pendingLaunchAction || pendingLaunchAction.type !== 'check-in') {
        return;
      }

      logAlarmDebug('Handling pending launch action', {
        pendingLaunchAction,
        source,
      });
      await stopExpiredAlarmPlayback();

      if (source === 'event') {
        skipNextResumeConsumeRef.current = true;
        suppressNextActiveReload();
        logAlarmDebug(
          'Skipped persisted reload for live launch action event to preserve in-memory expired interval state',
          {
            intervalId: pendingLaunchAction.intervalId,
          },
        );
      } else {
        await reloadPersistedState();
      }

      logAlarmDebug('Requesting check-in modal from launch action', {
        intervalId: pendingLaunchAction.intervalId,
        source,
      });
      onRequestCheckIn(pendingLaunchAction.intervalId);
    },
    [onRequestCheckIn, reloadPersistedState, suppressNextActiveReload],
  );

  const consumeAndReloadPendingCheckIn = useCallback(
    async (source: 'startup' | 'resume') => {
      await handleLaunchAction(await consumePendingAlarmLaunchAction(), source);
    },
    [handleLaunchAction],
  );

  useEffect(() => {
    if (!isHydrated || !isAlarmEngineAvailable()) {
      return;
    }

    let isCancelled = false;

    if (!didConsumeStartupActionRef.current) {
      didConsumeStartupActionRef.current = true;
      void consumeAndReloadPendingCheckIn('startup');
    }

    const subscription = addAlarmLaunchActionListener((launchAction) => {
      if (isCancelled) {
        return;
      }

      logAlarmDebug('Received native launch action event', launchAction);
      void handleLaunchAction(launchAction, 'event');
    });
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (isCancelled || nextAppState !== 'active') {
          return;
        }

        if (skipNextResumeConsumeRef.current) {
          skipNextResumeConsumeRef.current = false;
          return;
        }

        void consumeAndReloadPendingCheckIn('resume');
      },
    );

    return () => {
      isCancelled = true;
      appStateSubscription.remove();
      subscription?.remove();
    };
  }, [consumeAndReloadPendingCheckIn, handleLaunchAction, isHydrated]);

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
