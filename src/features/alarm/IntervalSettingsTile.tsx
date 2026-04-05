import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Tile } from '../../components/Tile';
import { useAppTheme } from '../theme/themeContext';

type IntervalSettingsTileProps = {
  alarmDurationSeconds: string;
  intervalMinutes: string;
  intervalSeconds: string;
  onAlarmDurationSecondsChange: (value: string) => void;
  onAlarmDurationSecondsBlur: () => void;
  onIntervalMinutesChange: (value: string) => void;
  onIntervalSecondsChange: (value: string) => void;
  onIntervalBlur: () => void;
};

export function IntervalSettingsTile({
  alarmDurationSeconds,
  intervalMinutes,
  intervalSeconds,
  onAlarmDurationSecondsBlur,
  onAlarmDurationSecondsChange,
  onIntervalBlur,
  onIntervalMinutesChange,
  onIntervalSecondsChange,
}: IntervalSettingsTileProps) {
  const { tokens } = useAppTheme();

  return (
    <Tile collapsible={false} floatingTitle title="Settings">
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: tokens.textPrimary }]}>
          Interval length
        </Text>
        <View style={styles.intervalRow}>
          <View style={styles.intervalInputGroup}>
            <Text style={[styles.intervalLabel, { color: tokens.textMuted }]}>
              Minutes
            </Text>
            <TextInput
              keyboardType="number-pad"
              onBlur={onIntervalBlur}
              onChangeText={onIntervalMinutesChange}
              style={[
                styles.input,
                {
                  backgroundColor: tokens.inputSurface,
                  borderColor: tokens.border,
                  color: tokens.textPrimary,
                },
              ]}
              value={intervalMinutes}
            />
          </View>
          <View style={styles.intervalInputGroup}>
            <Text style={[styles.intervalLabel, { color: tokens.textMuted }]}>
              Seconds
            </Text>
            <TextInput
              keyboardType="number-pad"
              onBlur={onIntervalBlur}
              onChangeText={onIntervalSecondsChange}
              style={[
                styles.input,
                {
                  backgroundColor: tokens.inputSurface,
                  borderColor: tokens.border,
                  color: tokens.textPrimary,
                },
              ]}
              value={intervalSeconds}
            />
          </View>
        </View>
      </View>
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: tokens.textPrimary }]}>
          Alarm duration in seconds
        </Text>
        <TextInput
          keyboardType="number-pad"
          onBlur={onAlarmDurationSecondsBlur}
          onChangeText={onAlarmDurationSecondsChange}
          style={[
            styles.input,
            {
              backgroundColor: tokens.inputSurface,
              borderColor: tokens.border,
              color: tokens.textPrimary,
            },
          ]}
          value={alarmDurationSeconds}
        />
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 8,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: 12,
  },
  intervalInputGroup: {
    flex: 1,
    gap: 6,
  },
  intervalLabel: {
    fontSize: 13,
    fontWeight: '700',
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
});
