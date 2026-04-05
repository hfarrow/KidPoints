import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Tile } from '../../components/Tile';
import { useAppStorage } from '../app/appStorage';
import { formatDuration, formatTime } from '../app/timer';
import { useAppTheme } from '../theme/themeContext';

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
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Alarm"
          subtitle="Configure the shared interval timer that drives point-earning check-ins."
        />

        <Tile eyebrow="Live status" title="Current cycle">
          <Text style={[styles.heroMetric, { color: tokens.textPrimary }]}>
            {formatDuration(timerSnapshot.remainingMs)}
          </Text>
          <Text style={[styles.supportingText, { color: tokens.textMuted }]}>
            {timerSnapshot.isRunning
              ? `Running. Next interval check-in at ${formatTime(timerSnapshot.nextTriggerAt)}.`
              : 'Paused. Starting the timer begins a fresh interval cycle.'}
          </Text>
          <View style={styles.actionRow}>
            <Pressable onPress={startTimer} style={styles.primaryAction}>
              <Text style={styles.primaryActionText}>Start fresh interval</Text>
            </Pressable>
            <Pressable onPress={pauseTimer} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>Pause</Text>
            </Pressable>
            <Pressable onPress={resetTimer} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>Reset</Text>
            </Pressable>
          </View>
        </Tile>

        <Tile eyebrow="Timing" title="Interval settings">
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: tokens.textPrimary }]}>
              Interval length in minutes
            </Text>
            <TextInput
              keyboardType="number-pad"
              onBlur={() => {
                const parsedValue = Number.parseInt(intervalInput || '15', 10);
                updateTimerConfig({
                  intervalMinutes: Number.isFinite(parsedValue)
                    ? Math.max(parsedValue, 1)
                    : 15,
                });
              }}
              onChangeText={setIntervalInput}
              style={[
                styles.input,
                {
                  backgroundColor: tokens.inputSurface,
                  borderColor: tokens.border,
                  color: tokens.textPrimary,
                },
              ]}
              value={intervalInput}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: tokens.textPrimary }]}>
              Alarm duration in seconds
            </Text>
            <TextInput
              keyboardType="number-pad"
              onBlur={() => {
                const parsedValue = Number.parseInt(durationInput || '20', 10);
                updateTimerConfig({
                  alarmDurationSeconds: Number.isFinite(parsedValue)
                    ? Math.max(parsedValue, 1)
                    : 20,
                });
              }}
              onChangeText={setDurationInput}
              style={[
                styles.input,
                {
                  backgroundColor: tokens.inputSurface,
                  borderColor: tokens.border,
                  color: tokens.textPrimary,
                },
              ]}
              value={durationInput}
            />
          </View>
        </Tile>

        <Tile eyebrow="Delivery" title="Notification placeholders">
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={[styles.fieldLabel, { color: tokens.textPrimary }]}>
                Notifications enabled
              </Text>
              <Text
                style={[styles.supportingText, { color: tokens.textMuted }]}
              >
                This persists the preference now. Native alarm and notification
                delivery will be added later.
              </Text>
            </View>
            <Switch
              onValueChange={(value) =>
                updateTimerConfig({ notificationsEnabled: value })
              }
              thumbColor="#f8fafc"
              trackColor={{ false: '#94a3b8', true: '#0f766e' }}
              value={appData.timerConfig.notificationsEnabled}
            />
          </View>
          <View style={styles.soundRow}>
            {(['Chime', 'Bell'] as const).map((sound) => {
              const selected = appData.timerConfig.alarmSound === sound;

              return (
                <Pressable
                  key={sound}
                  onPress={() => updateTimerConfig({ alarmSound: sound })}
                  style={[
                    styles.soundOption,
                    selected && styles.soundOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.soundOptionText,
                      selected && styles.soundOptionTextSelected,
                    ]}
                  >
                    {sound}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Tile>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    paddingTop: 12,
    gap: 16,
  },
  heroMetric: {
    fontSize: 50,
    fontWeight: '900',
  },
  supportingText: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryAction: {
    borderRadius: 999,
    backgroundColor: '#b45309',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  primaryActionText: {
    color: '#fffbeb',
    fontWeight: '800',
  },
  secondaryAction: {
    borderRadius: 999,
    backgroundColor: '#fde68a',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryActionText: {
    color: '#92400e',
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  switchCopy: {
    flex: 1,
    gap: 6,
  },
  soundRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  soundOption: {
    borderRadius: 999,
    backgroundColor: '#fde68a',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  soundOptionSelected: {
    backgroundColor: '#b45309',
  },
  soundOptionText: {
    fontWeight: '800',
    color: '#92400e',
  },
  soundOptionTextSelected: {
    color: '#fffbeb',
  },
});
