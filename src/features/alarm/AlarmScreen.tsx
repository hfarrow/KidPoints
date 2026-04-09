import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { MainScreenActions } from '../../components/MainScreenActions';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  ActionPillRow,
  CompactSurface,
  SectionLabel,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { createModuleLogger } from '../../logging/logger';
import { useSharedStore } from '../../state/sharedStore';
import { normalizeTimerConfig } from '../../state/sharedTimer';
import { NotificationSettingsTile } from '../notifications/NotificationSettingsTile';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import { CountdownTileSummary } from '../timer/CountdownTileSummary';
import { TimerControlRail } from '../timer/TimerControlRail';
import { useSharedTimerViewModel } from '../timer/useSharedTimerViewModel';

const log = createModuleLogger('alarm-screen');

export function AlarmScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isParentUnlocked } = useParentSession();
  const { tokens } = useAppTheme();
  const pauseTimer = useSharedStore((state) => state.pauseTimer);
  const resetTimer = useSharedStore((state) => state.resetTimer);
  const startTimer = useSharedStore((state) => state.startTimer);
  const timerConfig = useSharedStore(
    (state) => state.document.head.timerConfig,
  );
  const updateTimerConfig = useSharedStore((state) => state.updateTimerConfig);
  const timerViewModel = useSharedTimerViewModel();
  const [intervalMinutesInput, setIntervalMinutesInput] = useState('');
  const [intervalSecondsInput, setIntervalSecondsInput] = useState('');
  const [alarmDurationInput, setAlarmDurationInput] = useState('');

  useEffect(() => {
    log.debug('Alarm screen initialized');
  }, []);

  useEffect(() => {
    setIntervalMinutesInput(String(timerConfig.intervalMinutes));
    setIntervalSecondsInput(String(timerConfig.intervalSeconds));
    setAlarmDurationInput(String(timerConfig.alarmDurationSeconds));
  }, [
    timerConfig.alarmDurationSeconds,
    timerConfig.intervalMinutes,
    timerConfig.intervalSeconds,
  ]);

  const commitIntervalInputs = () => {
    const normalizedTimerConfig = normalizeTimerConfig(
      {
        ...timerConfig,
        intervalMinutes: Number.parseInt(intervalMinutesInput || '0', 10),
        intervalSeconds: Number.parseInt(intervalSecondsInput || '0', 10),
      },
      timerConfig,
    );

    setIntervalMinutesInput(String(normalizedTimerConfig.intervalMinutes));
    setIntervalSecondsInput(String(normalizedTimerConfig.intervalSeconds));
    updateTimerConfig({
      intervalMinutes: normalizedTimerConfig.intervalMinutes,
      intervalSeconds: normalizedTimerConfig.intervalSeconds,
    });
  };

  const commitAlarmDurationInput = () => {
    const normalizedTimerConfig = normalizeTimerConfig(
      {
        ...timerConfig,
        alarmDurationSeconds: Number.parseInt(alarmDurationInput || '0', 10),
      },
      timerConfig,
    );

    setAlarmDurationInput(String(normalizedTimerConfig.alarmDurationSeconds));
    updateTimerConfig({
      alarmDurationSeconds: normalizedTimerConfig.alarmDurationSeconds,
    });
  };

  return (
    <ScreenScaffold>
      <ScreenHeader
        actions={<MainScreenActions />}
        title="Alarm"
        titleIcon={
          <Feather color={tokens.textPrimary} name="clock" size={22} />
        }
      />

      {!isParentUnlocked ? (
        <Tile
          accessory={<StatusBadge label="Locked" tone="warning" />}
          title="Unlock Required"
        >
          <Text style={styles.unlockCopy}>
            Timer controls and settings require Parent Mode.
          </Text>
          <ActionPillRow>
            <ActionPill
              label="Unlock with PIN"
              onPress={() => router.push('/parent-unlock')}
              tone="primary"
            />
          </ActionPillRow>
        </Tile>
      ) : null}

      <Tile
        accessory={
          <StatusBadge
            label={timerViewModel.statusLabel}
            tone={timerViewModel.statusTone}
          />
        }
        summary={
          <CountdownTileSummary
            remainingLabel={timerViewModel.remainingLabel}
            statusLabel={timerViewModel.statusLabel}
            statusTone={timerViewModel.statusTone}
          />
        }
        title="Countdown"
      >
        {isParentUnlocked ? (
          <TimerControlRail
            contextLabel="Alarm"
            onPause={() => {
              pauseTimer();
            }}
            onReset={() => {
              resetTimer();
            }}
            onStart={() => {
              startTimer();
            }}
            pauseDisabled={!timerViewModel.canPause}
            resetDisabled={!timerViewModel.canReset}
            startDisabled={!timerViewModel.canStart}
          />
        ) : (
          <ActionPillRow>
            <ActionPill
              label="Unlock To Control"
              onPress={() => router.push('/parent-unlock')}
              tone="primary"
            />
          </ActionPillRow>
        )}
      </Tile>

      {isParentUnlocked ? (
        <Tile title="Settings">
          <View style={styles.settingsRow}>
            <CompactSurface style={styles.settingsSurface}>
              <SectionLabel>Cadence</SectionLabel>
              <View style={styles.intervalRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Min</Text>
                  <TextInput
                    accessibilityLabel="Interval minutes"
                    keyboardType="number-pad"
                    onBlur={commitIntervalInputs}
                    onChangeText={setIntervalMinutesInput}
                    style={styles.input}
                    value={intervalMinutesInput}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Sec</Text>
                  <TextInput
                    accessibilityLabel="Interval seconds"
                    keyboardType="number-pad"
                    onBlur={commitIntervalInputs}
                    onChangeText={setIntervalSecondsInput}
                    style={styles.input}
                    value={intervalSecondsInput}
                  />
                </View>
              </View>
            </CompactSurface>

            <CompactSurface style={styles.settingsSurface}>
              <SectionLabel>Alarm</SectionLabel>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mute After Sec</Text>
                <TextInput
                  accessibilityLabel="Mute after seconds"
                  keyboardType="number-pad"
                  onBlur={commitAlarmDurationInput}
                  onChangeText={setAlarmDurationInput}
                  style={styles.input}
                  value={alarmDurationInput}
                />
              </View>
            </CompactSurface>
          </View>
        </Tile>
      ) : null}

      <NotificationSettingsTile />
    </ScreenScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    unlockCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    settingsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    settingsSurface: {
      flexGrow: 1,
      minWidth: 150,
    },
    intervalRow: {
      flexDirection: 'row',
      gap: 10,
    },
    inputGroup: {
      flex: 1,
      gap: 6,
      minWidth: 0,
    },
    inputLabel: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    input: {
      backgroundColor: tokens.inputSurface,
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      color: tokens.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      minHeight: 42,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
  });
