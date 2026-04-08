import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

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
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/themeContext';
import { TimerControlRail } from '../timer/TimerControlRail';
import { useSharedTimerViewModel } from '../timer/useSharedTimerViewModel';

const log = createModuleLogger('alarm-screen');

function ReadinessRow({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.readinessRow}>
      <Text style={styles.readinessLabel}>{label}</Text>
      <Text style={styles.readinessValue}>{value}</Text>
    </View>
  );
}

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

  const nativeBridgeLabel =
    Platform.OS === 'android'
      ? 'Module present, JS bridge pending'
      : 'Android integration pending';

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
          <View style={styles.timerSummary}>
            <View style={styles.timerSummaryCopy}>
              <Text style={styles.primaryMetric}>
                {timerViewModel.remainingLabel}
              </Text>
              <View style={styles.timerMetaRow}>
                <Text style={styles.timerMeta}>
                  {timerViewModel.cadenceLabel}
                </Text>
                <Text style={styles.timerMeta}>
                  {timerViewModel.alarmDurationLabel}
                </Text>
              </View>
            </View>
          </View>
        }
        title="Timer"
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
                <Text style={styles.inputLabel}>Duration Sec</Text>
                <TextInput
                  accessibilityLabel="Alarm duration seconds"
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

      <Tile
        accessory={<StatusBadge label="Pending" tone="warning" />}
        title="Readiness"
      >
        <CompactSurface>
          <ReadinessRow label="Timer Mode" value={timerViewModel.statusLabel} />
          <ReadinessRow label="Native Alarm Bridge" value={nativeBridgeLabel} />
          <ReadinessRow
            label="Notifications"
            value="Live alarm handling still pending"
          />
          <ReadinessRow
            label="Saved Alarm Duration"
            value={timerViewModel.alarmDurationLabel}
          />
        </CompactSurface>
      </Tile>
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
    timerSummary: {
      flex: 1,
      minWidth: 0,
    },
    timerSummaryCopy: {
      gap: 4,
      minWidth: 0,
    },
    primaryMetric: {
      color: tokens.textPrimary,
      fontSize: 32,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.7,
    },
    timerMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    timerMeta: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '800',
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
    readinessRow: {
      gap: 3,
    },
    readinessLabel: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    readinessValue: {
      color: tokens.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
  });
