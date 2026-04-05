import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import {
  isAlarmEngineAvailable,
  openExactAlarmSettings,
  openFullScreenIntentSettings,
  openNotificationSettings,
  openPromotedNotificationSettings,
} from '../app/alarmEngine';
import { useAppStorage } from '../app/appStorage';
import { useAppTheme } from '../theme/themeContext';
import { AlarmTile } from './AlarmTile';
import { IntervalSettingsTile } from './IntervalSettingsTile';
import { NotificationSettingsTile } from './NotificationSettingsTile';

export function AlarmScreen() {
  const { getScreenSurface, tokens } = useAppTheme();
  const {
    alarmRuntimeStatus,
    appData,
    isHydrated,
    parentSession,
    pauseTimer,
    refreshAlarmRuntimeStatus,
    resetTimer,
    startTimer,
    timerSnapshot,
    updateTimerConfig,
  } = useAppStorage();
  const router = useRouter();
  const [intervalMinutesInput, setIntervalMinutesInput] = useState('');
  const [intervalSecondsInput, setIntervalSecondsInput] = useState('');
  const [durationInput, setDurationInput] = useState('');

  useEffect(() => {
    if (!isHydrated || parentSession.isUnlocked) {
      return;
    }

    router.replace('/');
  }, [isHydrated, parentSession.isUnlocked, router]);

  useEffect(() => {
    setIntervalMinutesInput(String(appData.timerConfig.intervalMinutes));
    setIntervalSecondsInput(String(appData.timerConfig.intervalSeconds));
    setDurationInput(String(appData.timerConfig.alarmDurationSeconds));
  }, [
    appData.timerConfig.alarmDurationSeconds,
    appData.timerConfig.intervalMinutes,
    appData.timerConfig.intervalSeconds,
  ]);

  if (!isHydrated || !parentSession.isUnlocked) {
    return null;
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        { backgroundColor: getScreenSurface(parentSession.isUnlocked) },
      ]}
    >
      <ScrollView
        contentContainerStyle={[styles.content, tokens.layout.tabScreenContent]}
      >
        <ScreenHeader title="Alarm" />

        <AlarmTile
          isParentUnlocked={parentSession.isUnlocked}
          onPause={pauseTimer}
          onReset={resetTimer}
          onStart={startTimer}
          remainingMs={timerSnapshot.remainingMs}
          running={timerSnapshot.isRunning}
        />

        <IntervalSettingsTile
          alarmDurationSeconds={durationInput}
          intervalMinutes={intervalMinutesInput}
          intervalSeconds={intervalSecondsInput}
          onAlarmDurationSecondsBlur={() => {
            const parsedValue = Number.parseInt(durationInput || '20', 10);
            updateTimerConfig({
              alarmDurationSeconds: Number.isFinite(parsedValue)
                ? Math.max(parsedValue, 1)
                : 20,
            });
          }}
          onAlarmDurationSecondsChange={setDurationInput}
          onIntervalBlur={() => {
            const parsedMinutes = Number.parseInt(
              intervalMinutesInput || '0',
              10,
            );
            const parsedSeconds = Number.parseInt(
              intervalSecondsInput || '0',
              10,
            );
            const normalizedMinutes = Number.isFinite(parsedMinutes)
              ? Math.max(parsedMinutes, 0)
              : 0;
            const normalizedSeconds = Number.isFinite(parsedSeconds)
              ? Math.max(parsedSeconds, 0)
              : 0;
            const totalSeconds = Math.max(
              normalizedMinutes * 60 + normalizedSeconds,
              1,
            );
            const nextMinutes = Math.floor(totalSeconds / 60);
            const nextSeconds = totalSeconds % 60;

            setIntervalMinutesInput(String(nextMinutes));
            setIntervalSecondsInput(String(nextSeconds));
            updateTimerConfig({
              intervalMinutes: nextMinutes,
              intervalSeconds: nextSeconds,
            });
          }}
          onIntervalMinutesChange={setIntervalMinutesInput}
          onIntervalSecondsChange={setIntervalSecondsInput}
        />

        <NotificationSettingsTile
          engineAvailable={isAlarmEngineAvailable()}
          exactAlarmPermissionGranted={
            alarmRuntimeStatus.exactAlarmPermissionGranted
          }
          expiredNotificationCategory={
            alarmRuntimeStatus.expiredNotificationCategory
          }
          expiredNotificationChannelImportance={
            alarmRuntimeStatus.expiredNotificationChannelImportance
          }
          expiredNotificationHasCustomHeadsUp={
            alarmRuntimeStatus.expiredNotificationHasCustomHeadsUp
          }
          expiredNotificationHasFullScreenIntent={
            alarmRuntimeStatus.expiredNotificationHasFullScreenIntent
          }
          fullScreenIntentPermissionGranted={
            alarmRuntimeStatus.fullScreenIntentPermissionGranted
          }
          fullScreenIntentSettingsResolvable={
            alarmRuntimeStatus.fullScreenIntentSettingsResolvable
          }
          isAppInForeground={alarmRuntimeStatus.isAppInForeground}
          countdownNotificationChannelImportance={
            alarmRuntimeStatus.countdownNotificationChannelImportance
          }
          countdownNotificationHasPromotableCharacteristics={
            alarmRuntimeStatus.countdownNotificationHasPromotableCharacteristics
          }
          countdownNotificationIsOngoing={
            alarmRuntimeStatus.countdownNotificationIsOngoing
          }
          countdownNotificationRequestedPromoted={
            alarmRuntimeStatus.countdownNotificationRequestedPromoted
          }
          countdownNotificationUsesChronometer={
            alarmRuntimeStatus.countdownNotificationUsesChronometer
          }
          countdownNotificationWhen={
            alarmRuntimeStatus.countdownNotificationWhen
          }
          expiredIntervalsCount={appData.expiredIntervals.length}
          isRunning={alarmRuntimeStatus.isRunning}
          lastTriggeredAt={alarmRuntimeStatus.lastTriggeredAt}
          nextTriggerAt={alarmRuntimeStatus.nextTriggerAt}
          notificationPermissionGranted={
            alarmRuntimeStatus.notificationPermissionGranted
          }
          promotedNotificationSettingsResolvable={
            alarmRuntimeStatus.promotedNotificationSettingsResolvable
          }
          promotedNotificationPermissionGranted={
            alarmRuntimeStatus.promotedNotificationPermissionGranted
          }
          notificationsEnabled={appData.timerConfig.notificationsEnabled}
          onNotificationsEnabledChange={(value) =>
            updateTimerConfig({ notificationsEnabled: value })
          }
          onOpenExactAlarmSettings={() => {
            void openExactAlarmSettings().then(() => {
              void refreshAlarmRuntimeStatus();
            });
          }}
          onOpenNotificationSettings={() => {
            void openNotificationSettings().then(() => {
              void refreshAlarmRuntimeStatus();
            });
          }}
          onOpenFullScreenIntentSettings={() => {
            void openFullScreenIntentSettings().then(() => {
              void refreshAlarmRuntimeStatus();
            });
          }}
          onOpenPromotedNotificationSettings={() => {
            void openPromotedNotificationSettings().then(() => {
              void refreshAlarmRuntimeStatus();
            });
          }}
          onRefreshStatus={() => {
            void refreshAlarmRuntimeStatus();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},
});
