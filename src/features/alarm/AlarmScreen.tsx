import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppStorage } from '../app/appStorage';
import { useAppTheme } from '../theme/themeContext';
import { AlarmTile } from './AlarmTile';
import { IntervalSettingsTile } from './IntervalSettingsTile';
import { NotificationSettingsTile } from './NotificationSettingsTile';

export function AlarmScreen() {
  const { getScreenSurface, tokens } = useAppTheme();
  const {
    appData,
    isHydrated,
    parentSession,
    pauseTimer,
    resetTimer,
    startTimer,
    timerSnapshot,
    updateTimerConfig,
  } = useAppStorage();
  const router = useRouter();
  const [intervalInput, setIntervalInput] = useState('');
  const [durationInput, setDurationInput] = useState('');

  useEffect(() => {
    if (!isHydrated || parentSession.isUnlocked) {
      return;
    }

    router.replace('/');
  }, [isHydrated, parentSession.isUnlocked, router]);

  useEffect(() => {
    setIntervalInput(String(appData.timerConfig.intervalMinutes));
    setDurationInput(String(appData.timerConfig.alarmDurationSeconds));
  }, [
    appData.timerConfig.alarmDurationSeconds,
    appData.timerConfig.intervalMinutes,
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
          intervalMinutes={intervalInput}
          onAlarmDurationSecondsBlur={() => {
            const parsedValue = Number.parseInt(durationInput || '20', 10);
            updateTimerConfig({
              alarmDurationSeconds: Number.isFinite(parsedValue)
                ? Math.max(parsedValue, 1)
                : 20,
            });
          }}
          onAlarmDurationSecondsChange={setDurationInput}
          onIntervalMinutesBlur={() => {
            const parsedValue = Number.parseInt(intervalInput || '15', 10);
            updateTimerConfig({
              intervalMinutes: Number.isFinite(parsedValue)
                ? Math.max(parsedValue, 1)
                : 15,
            });
          }}
          onIntervalMinutesChange={setIntervalInput}
        />

        <NotificationSettingsTile
          alarmSound={appData.timerConfig.alarmSound}
          notificationsEnabled={appData.timerConfig.notificationsEnabled}
          onAlarmSoundChange={(sound) =>
            updateTimerConfig({ alarmSound: sound })
          }
          onNotificationsEnabledChange={(value) =>
            updateTimerConfig({ notificationsEnabled: value })
          }
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
